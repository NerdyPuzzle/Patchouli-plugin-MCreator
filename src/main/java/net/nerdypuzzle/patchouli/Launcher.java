package net.nerdypuzzle.patchouli;

import net.mcreator.element.ModElementType;
import net.mcreator.element.ModElementTypeLoader;
import net.mcreator.plugin.JavaPlugin;
import net.mcreator.plugin.Plugin;
import net.mcreator.plugin.events.PreGeneratorsLoadingEvent;
import net.nerdypuzzle.patchouli.elements.Guidebook;
import net.nerdypuzzle.patchouli.elements.GuidebookGUI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class Launcher extends JavaPlugin {

	private static final Logger LOG = LogManager.getLogger("Patchouli");

	public Launcher(Plugin plugin) {
		super(plugin);

		addListener(PreGeneratorsLoadingEvent.class, e -> ModElementTypeLoader.register(
				new ModElementType<>("guidebook", 'G', GuidebookGUI::new, Guidebook.class)));

		LOG.info("Patchouli plugin was loaded");
	}

}