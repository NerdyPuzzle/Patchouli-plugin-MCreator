package net.nerdypuzzle.patchouli.elements;

import net.mcreator.ui.MCreator;
import net.mcreator.ui.modgui.ModElementGUI;
import net.mcreator.workspace.elements.ModElement;
import net.nerdypuzzle.patchouli.parts.GuidebookPanel;

import javax.annotation.Nullable;
import java.net.URI;
import java.net.URISyntaxException;

public class GuidebookGUI extends ModElementGUI<Guidebook> {

	private GuidebookPanel editor;

	public GuidebookGUI(MCreator mcreator, ModElement modElement, boolean editingMode) {
		super(mcreator, modElement, editingMode);
		this.initGUI();
		super.finalizeGUI();
	}

	@Override protected void initGUI() {
		editor = new GuidebookPanel(mcreator, modElement);

		addPage(editor);

		if (!isEditingMode())
			editor.openInEditingMode(new Guidebook(modElement));
	}

	@Override protected void openInEditingMode(Guidebook guidebook) {
		editor.openInEditingMode(guidebook);
	}

	@Override public Guidebook getElementFromGUI() {
		return editor.getGuidebook();
	}

	@Override public void onViewClosed() {
		super.onViewClosed();
		editor.close();
	}

	@Override public @Nullable URI contextURL() throws URISyntaxException {
		return new URI("https://vazkiimods.github.io/Patchouli/docs/patchouli-basics/getting-started/");
	}

}