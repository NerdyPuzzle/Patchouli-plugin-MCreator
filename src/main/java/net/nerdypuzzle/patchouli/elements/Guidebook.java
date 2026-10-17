package net.nerdypuzzle.patchouli.elements;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.mcreator.element.GeneratableElement;
import net.mcreator.util.StringUtils;
import net.mcreator.workspace.Workspace;
import net.mcreator.workspace.elements.ModElement;

import javax.annotation.Nullable;
import java.util.*;

@SuppressWarnings("unused") public class Guidebook extends GeneratableElement {

	public static final Gson GSON = new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create();

	// Book properties
	public String bookName = "";
	public String landingText = "Welcome to the guide book!";
	public String subtitle = "";
	public String version = "0";
	public boolean pamphlet = false;
	public String creativeTab = "TOOLS";
	public String model = "patchouli:book_brown";
	public String bookTexture = "patchouli:textures/gui/book_brown.png";
	public String fillerTexture = "";
	public String craftingTexture = "";
	public String openSound = "";
	public String flipSound = "";
	public String indexIcon = "minecraft:writable_book";
	public boolean showProgress = true;
	public String advancementsTab = "";
	public boolean showToasts = true;
	public boolean useBlockyFont = false;
	public boolean pauseGame = false;
	public String textOverflowMode = "overflow";

	// Colors
	public String textColor = "000000";
	public String headerColor = "333333";
	public String nameplateColor = "FFDD00";
	public String linkColor = "0000EE";
	public String linkHoverColor = "8800EE";
	public String progressBarColor = "FFFF55";
	public String progressBarBackground = "DDDDDD";

	// Obtaining the book
	public boolean giveOnFirstJoin = false;
	public boolean hasRecipe = true;
	public String recipeType = "shapeless";
	public List<String> recipeIngredients = new ArrayList<>();
	public List<String> recipePattern = new ArrayList<>();

	// Content
	public List<Category> categories = new ArrayList<>();
	public List<Entry> entries = new ArrayList<>();

	private Guidebook() {
		this(null);
	}

	public Guidebook(@Nullable ModElement element) {
		super(element);

		if (element != null)
			this.bookName = StringUtils.machineToReadableName(element.getName());

		addDefaultContent();
	}

	private void addDefaultContent() {
		categories.add(new Category("getting_started", "Getting Started",
				"Learn the basics of the mod through this guidebook.", "minecraft:book"));

		Entry welcome = new Entry("welcome", "Welcome", "getting_started", "minecraft:book");

		Page intro = new Page("patchouli:text");
		intro.text = "Welcome to the guidebook!$(br2)This guidebook can contain important information, guides, and tutorials.$(br2)Read the next page to learn more.";
		welcome.pages.add(intro);

		Page features = new Page("patchouli:text");
		features.title = "Features";
		features.text = "Here you can document items, blocks, recipes, multiblocks, and entities.";
		welcome.pages.add(features);

		entries.add(welcome);
	}

	public static Guidebook fromJson(String json, ModElement element) {
		Guidebook guidebook = GSON.fromJson(json, Guidebook.class);
		if (guidebook == null)
			return new Guidebook(element);
		guidebook.setModElement(element);
		return guidebook;
	}

	public String toJson() {
		return GSON.toJson(this);
	}

	public String mapCreativeTab(String tab, @Nullable Workspace workspace) {
		if (tab == null || tab.isBlank() || tab.equals("No creative tab"))
			return "";
		if (tab.startsWith("CUSTOM:")) {
			if (workspace != null) {
				ModElement element = workspace.getModElementByName(tab.substring("CUSTOM:".length()));
				if (element != null)
					return workspace.getWorkspaceSettings().getModID() + ":" + element.getRegistryName();
				return workspace.getWorkspaceSettings().getModID() + ":" + tab.substring("CUSTOM:".length()).toLowerCase(Locale.ENGLISH);
			}
			return tab.substring("CUSTOM:".length()).toLowerCase(Locale.ENGLISH);
		}
		return switch (tab) {
			case "BUILDING_BLOCKS" -> "building_blocks";
			case "DECORATIONS" -> "natural_blocks";
			case "REDSTONE" -> "redstone_blocks";
			case "FOOD" -> "food_and_drinks";
			case "TOOLS" -> "tools_and_utilities";
			case "COMBAT" -> "combat";
			case "MATERIALS" -> "ingredients";
			case "MISC" -> "spawn_eggs";
			case "TRANSPORTATION" -> "functional_blocks";
			case "BREWING" -> "colored_blocks";
			case "OP_BLOCKS" -> "op_blocks";
			default -> tab;
		};
	}

	public String getMappedCreativeTab() {
		Workspace ws = getModElement() != null ? getModElement().getWorkspace() : null;
		return mapCreativeTab(creativeTab, ws);
	}

	public boolean hasRecipe() {
		return hasRecipe && !getValidRecipeIngredients().isEmpty();
	}

	public List<String> getValidRecipeIngredients() {
		List<String> valid = new ArrayList<>();
		if (recipeIngredients != null) {
			for (String ing : recipeIngredients) {
				if (!isEmptyIngredient(ing)) {
					valid.add(ing);
				}
			}
		}
		return valid;
	}

	public String[][] getOptimisedRecipe() {
		String[][] mtx = new String[3][3];
		for (int i = 0; i < 9; i++) {
			int r = i / 3;
			int c = i % 3;
			String ing = recipeIngredients != null && i < recipeIngredients.size() ? recipeIngredients.get(i) : "";
			mtx[r][c] = isEmptyIngredient(ing) ? "" : ing;
		}

		int cmin = 3;
		int rmin = 3;
		int cmax = -1;
		int rmax = -1;
		for (int r = 0; r < 3; r++) {
			for (int c = 0; c < 3; c++) {
				if (!mtx[r][c].isEmpty()) {
					if (cmin > c) cmin = c;
					if (cmax < c) cmax = c;
					if (rmin > r) rmin = r;
					if (rmax < r) rmax = r;
				}
			}
		}

		if (cmax == -1) {
			return new String[][] { { "minecraft:book" } };
		}

		String[][] result = new String[rmax - rmin + 1][];
		for (int r = rmin, i = 0; r <= rmax; r++, i++) {
			result[i] = Arrays.copyOfRange(mtx[r], cmin, cmax + 1);
		}
		return result;
	}

	public Map<String, String> getPatternKeys() {
		Map<String, String> keys = new LinkedHashMap<>();
		int idx = 0;
		if (recipeIngredients != null) {
			for (String slot : recipeIngredients) {
				if (!isEmptyIngredient(slot) && !keys.containsKey(slot)) {
					keys.put(slot, Character.toString((char) ('a' + idx)));
					idx++;
				}
			}
		}
		return keys;
	}

	public List<Category> getCategories() {
		return categories;
	}

	public List<Entry> getEntries() {
		return entries;
	}

	private boolean isEmptyIngredient(@Nullable String id) {
		return id == null || id.isBlank() || id.equals("minecraft:air") || id.equals("empty");
	}

	public static class Category {
		public String id = "";
		public String name = "";
		public String description = "";
		public String icon = "minecraft:book";
		public String parent = "";
		public int sortnum = 0;
		public boolean secret = false;

		public Category(String id, String name, String description, String icon) {
			this.id = id;
			this.name = name;
			this.description = description;
			this.icon = icon;
		}

		public String getId() {
			return id;
		}
	}

	public static class Entry {
		public String id = "";
		public String name = "";
		public String category = "";
		public String icon = "minecraft:book";
		public List<Page> pages = new ArrayList<>();
		public String advancement = "";
		public boolean priority = false;
		public boolean secret = false;
		public boolean readByDefault = false;
		public int sortnum = 0;
		public String turnin = "";
		public String entryColor = "";

		public Entry(String id, String name, String category, String icon) {
			this.id = id;
			this.name = name;
			this.category = category;
			this.icon = icon;
		}

		public String getId() {
			return id;
		}
	}

	public static class Page {
		public String type = "patchouli:text";
		public String advancement = "";

		public String title = "";
		public String text = "";

		public List<String> images = new ArrayList<>();
		public boolean border = false;

		public String recipe = "";
		public String recipe2 = "";

		public boolean enableVisualize = true;
		public Multiblock multiblock;

		public String entity = "";
		public float scale = 1.0f;
		public float offset = 0.0f;
		public boolean rotate = true;
		public float defaultRotation = -45.0f;
		public String name = "";

		public String item = "";
		public boolean linkRecipe = false;

		public String url = "";
		public String linkText = "";

		public List<String> entries = new ArrayList<>();

		public String trigger = "";

		public boolean drawFiller = true;

		public Map<String, String> customVariables = new LinkedHashMap<>();

		public Page(String type) {
			this.type = type;
		}
	}

	public static class Multiblock {
		public List<List<String>> pattern = new ArrayList<>();
		public Map<String, String> mapping = new LinkedHashMap<>();
		public boolean symmetrical = true;
		public List<Integer> offset = new ArrayList<>();
	}

}