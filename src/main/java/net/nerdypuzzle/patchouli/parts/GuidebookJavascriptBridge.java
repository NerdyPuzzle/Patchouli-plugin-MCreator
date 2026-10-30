package net.nerdypuzzle.patchouli.parts;

import net.mcreator.element.parts.MItemBlock;
import net.mcreator.generator.GeneratorUtils;
import net.mcreator.generator.GeneratorWrapper;
import net.mcreator.generator.mapping.NameMapper;
import net.mcreator.minecraft.DataListEntry;
import net.mcreator.minecraft.DataListLoader;
import net.mcreator.minecraft.ElementUtil;
import net.mcreator.minecraft.MCItem;
import net.mcreator.ui.MCreator;
import net.mcreator.ui.dialogs.MCItemSelectorDialog;
import net.mcreator.ui.init.L10N;
import net.mcreator.ui.init.UIRES;
import net.mcreator.ui.workspace.resources.TextureType;
import net.mcreator.util.image.ImageUtils;
import net.mcreator.workspace.resources.Model;
import net.nerdypuzzle.patchouli.elements.Guidebook;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.annotation.Nullable;
import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.function.Consumer;

public final class GuidebookJavascriptBridge {

	private static final Logger LOG = LogManager.getLogger("Guidebook JavaScript Bridge");

	private final MCreator mcreator;
	private final LinkedHashMap<TexturePreviewKey, String> texturePreviews = new LinkedHashMap<>(16, .75f, true);

	private record TexturePreviewKey(Path file, FileTime modified, long size, int resolution) {}

	public GuidebookJavascriptBridge(MCreator mcreator) {
		this.mcreator = mcreator;
	}

	@SuppressWarnings("unused") public String getCreativeTabsJSON() {
		List<String[]> tabs = new ArrayList<>();
		tabs.add(new String[]{"", "No creative tab"});
		try {
			for (DataListEntry entry : ElementUtil.loadAllTabs(mcreator.getWorkspace()))
				tabs.add(new String[]{entry.getName(), entry.getReadableName()});
		} catch (Exception e) {
			LOG.error("Failed to load creative tabs", e);
		}
		return Guidebook.GSON.toJson(tabs);
	}

	@SuppressWarnings("unused") public String getAdvancementsJSON() {
		List<String[]> advancements = new ArrayList<>();
		advancements.add(new String[]{"", "No advancement"});
		try {
			for (DataListEntry entry : ElementUtil.loadAllAchievements(mcreator.getWorkspace())) {
				if ("No parent: root".equals(entry.getName()))
					continue;
				advancements.add(new String[]{entry.getName(), entry.getReadableName()});
			}
		} catch (Exception e) {
			LOG.error("Failed to load advancements", e);
		}
		return Guidebook.GSON.toJson(advancements);
	}

	@SuppressWarnings("unused") public String getWorkspaceModId() {
		return mcreator.getWorkspace().getWorkspaceSettings().getModID();
	}

	@SuppressWarnings("unused") public String getSoundsJSON() {
		List<String[]> sounds = new ArrayList<>();
		sounds.add(new String[]{"", "Default sound"});
		try {
			for (DataListEntry entry : ElementUtil.loadAllSounds(mcreator.getWorkspace()))
				sounds.add(new String[]{entry.getName(), entry.getReadableName()});
		} catch (Exception e) {
			LOG.error("Failed to load sounds", e);
		}
		return Guidebook.GSON.toJson(sounds);
	}

	@SuppressWarnings("unused") public void openMCItemSelector(Consumer<String> callback) {
		SwingUtilities.invokeLater(() -> {
			MCItem selected = MCItemSelectorDialog.openSelectorDialog(mcreator, ElementUtil::loadBlocksAndItems);
			callback.accept(selected == null ? null : itemResourceLocation(selected.getName()));
		});
	}

	@SuppressWarnings("unused") public String getMCItemURI(String value) {
		if (value == null || value.isBlank())
			return "";
		String id = resourceLocation(value.split("\\[", 2)[0]);
		if (id.isEmpty())
			return "";
		if (id.startsWith("#"))
			return iconURI(MCItem.TAG_ICON);

		var workspace = mcreator.getWorkspace();
		if (id.startsWith(workspace.getWorkspaceSettings().getModID() + ":")) {
			for (var element : workspace.getModElements()) {
				for (MCItem item : element.getMCItems()) {
					if (id.equals(itemResourceLocation(item.getName())))
						return iconURI(item.getIcon());
				}
			}
		}
		for (var entry : DataListLoader.loadDataList("blocksitems")) {
			if (entry instanceof MCItem item && item.hasNoSubtypes() && item.isSupportedInWorkspace(workspace)
					&& id.equals(itemResourceLocation(item.getName())))
				return iconURI(item.getIcon());
		}
		return "";
	}

	private String itemResourceLocation(String name) {
		if (name == null || name.isBlank())
			return "";
		var workspace = mcreator.getWorkspace();
		if (name.startsWith("TAG:"))
			return resourceLocation("#" + new MItemBlock(workspace, name).asTagEntry());
		if (name.startsWith(NameMapper.EXTERNAL_PREFIX))
			return resourceLocation(name.substring(NameMapper.EXTERNAL_PREFIX.length()));
		boolean custom = name.startsWith(NameMapper.MCREATOR_PREFIX);
		if (!custom && !name.startsWith("Blocks.") && !name.startsWith("Items."))
			return resourceLocation(name);
		if (custom && workspace.getModElementByName(GeneratorWrapper.getElementPlainName(name)) == null)
			return "";
		var mapping = workspace.getGenerator().getMappings().getMapping("blocksitems");
		if (mapping == null || (!custom && !mapping.containsKey(name)))
			return "";
		String mapped = new MItemBlock(workspace, name).getMappedValue(1);
		return name.equals(mapped) ? "" : resourceLocation(mapped);
	}

	private static String resourceLocation(@Nullable String value) {
		if (value == null)
			return "";
		value = value.trim();
		boolean tag = value.startsWith("#");
		String id = tag ? value.substring(1) : value;
		if (!id.contains(":"))
			id = "minecraft:" + id;
		return id.matches("[a-z0-9_.-]+:[a-z0-9/._-]+") ? (tag ? "#" : "") + id : "";
	}

	private String iconURI(@Nullable ImageIcon icon) {
		if (icon == null)
			return "";
		try {
			return pngURI(ImageUtils.toBufferedImage(icon.getImage()));
		} catch (Exception e) {
			LOG.error("Failed to encode item icon", e);
			return "";
		}
	}

	@SuppressWarnings("unused") public String getScreenTexturesJSON() {
		List<String[]> textures = new ArrayList<>();
		try {
			for (var file : mcreator.getWorkspace().getFolderManager().getTexturesList(TextureType.SCREEN)) {
				String location = screenTextureLocation(file.toPath());
				if (!location.isEmpty())
					textures.add(new String[]{location, file.getName().replaceFirst("\\.png$", ""), screenTexturePreview(file.toPath(), 24)});
			}
			textures.sort(Comparator.comparing(t -> t[1], String.CASE_INSENSITIVE_ORDER));
		} catch (Exception e) {
			LOG.error("Failed to load screen textures", e);
		}
		return Guidebook.GSON.toJson(textures);
	}

	@SuppressWarnings("unused") public String getItemTexturesJSON() {
		List<String[]> textures = new ArrayList<>();
		try {
			for (var file : mcreator.getWorkspace().getFolderManager().getTexturesList(TextureType.ITEM)) {
				String name = file.getName().replaceFirst("\\.png$", "");
				textures.add(new String[]{name, name, screenTexturePreview(file.toPath(), 24)});
			}
			textures.sort(Comparator.comparing(t -> t[1], String.CASE_INSENSITIVE_ORDER));
		} catch (Exception e) {
			LOG.error("Failed to load item textures", e);
		}
		return Guidebook.GSON.toJson(textures);
	}

	@SuppressWarnings("unused") public String getJSONModelsJSON() {
		List<String[]> models = new ArrayList<>();
		try {
			String icon = iconURI(UIRES.get("model.small_json"));
			for (Model model : Model.getModelsWithTextureMaps(mcreator.getWorkspace())) {
				if (model.getType() == Model.Type.JSON)
					models.add(new String[]{model.getReadableName(), model.toString(), icon});
			}
			models.sort(Comparator.comparing(m -> m[1], String.CASE_INSENSITIVE_ORDER));
		} catch (Exception e) {
			LOG.error("Failed to load JSON models", e);
		}
		return Guidebook.GSON.toJson(models);
	}

	@SuppressWarnings("unused") public String getScreenTextureURI(String location) {
		if (location == null || location.isBlank())
			return "";
		try {
			for (var file : mcreator.getWorkspace().getFolderManager().getTexturesList(TextureType.SCREEN)) {
				if (location.equals(screenTextureLocation(file.toPath()))) {
					screenTexturePreview(file.toPath(), 24);
					return screenTexturePreview(file.toPath(), 1024);
				}
			}
		} catch (Exception e) {
			LOG.warn("Failed to load screen texture {}", location, e);
		}
		return "";
	}

	@SuppressWarnings("unused") public void preloadScreenTexture(String location, Consumer<String> callback) {
		Thread.startVirtualThread(() -> callback.accept(getScreenTextureURI(location)));
	}

	private String screenTextureLocation(Path file) {
		var workspace = mcreator.getWorkspace();
		Path assets = GeneratorUtils.getModAssetsRoot(workspace, workspace.getGeneratorConfiguration())
				.toPath().toAbsolutePath().normalize();
		Path texture = file.toAbsolutePath().normalize();
		if (!texture.startsWith(assets) || !Files.isRegularFile(texture))
			return "";
		return workspace.getWorkspaceSettings().getModID() + ":" + assets.relativize(texture)
				.toString().replace('\\', '/');
	}

	private synchronized String screenTexturePreview(Path file, int resolution) {
		try {
			var attributes = Files.readAttributes(file, java.nio.file.attribute.BasicFileAttributes.class);
			var key = new TexturePreviewKey(file, attributes.lastModifiedTime(), attributes.size(), resolution);
			String cached = texturePreviews.get(key);
			if (cached != null)
				return cached;
			BufferedImage image = ImageIO.read(file.toFile());
			if (image == null)
				return "";
			boolean thumbnail = resolution == 24;
			double scale = (double) resolution / Math.max(image.getWidth(), image.getHeight());
			if (!thumbnail)
				scale = Math.min(1, scale);
			int width = Math.max(1, (int) Math.round(image.getWidth() * scale));
			int height = Math.max(1, (int) Math.round(image.getHeight() * scale));
			BufferedImage preview = new BufferedImage(thumbnail ? 24 : width, thumbnail ? 24 : height, BufferedImage.TYPE_INT_ARGB);
			var graphics = preview.createGraphics();
			try {
				graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
				graphics.drawImage(image, (preview.getWidth() - width) / 2, (preview.getHeight() - height) / 2, width, height, null);
			} finally {
				graphics.dispose();
				image.flush();
			}
			String uri = pngURI(preview);
			texturePreviews.put(key, uri);
			while (texturePreviews.size() > 64 || texturePreviews.values().stream().mapToInt(String::length).sum() > 32 * 1024 * 1024)
				texturePreviews.pollFirstEntry();
			return uri;
		} catch (IOException e) {
			LOG.warn("Failed to preview screen texture {}", file.getFileName(), e);
			return "";
		}
	}

	private String pngURI(BufferedImage image) throws IOException {
		var bytes = new ByteArrayOutputStream();
		ImageIO.write(image, "PNG", bytes);
		return pngURI(bytes.toByteArray());
	}

	private String pngURI(byte[] bytes) {
		return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
	}

    @SuppressWarnings("unused") public String t(String key) {
        return L10N.t(key);
    }

}