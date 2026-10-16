package net.nerdypuzzle.patchouli.parts;

import net.mcreator.ui.MCreator;
import net.mcreator.ui.chromium.WebView;
import net.mcreator.workspace.elements.ModElement;
import net.nerdypuzzle.patchouli.elements.Guidebook;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import javax.annotation.Nullable;
import javax.swing.*;
import java.awt.*;
import java.io.Closeable;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public class GuidebookPanel extends JPanel implements Closeable {

	private static final Logger LOG = LogManager.getLogger("Guidebook Panel");

	private final ModElement modElement;
	private final WebView webView;

	private final BlockingQueue<Runnable> runAfterLoaded = new LinkedBlockingQueue<>();

	private boolean loaded = false;

	@Nullable private Guidebook lastKnownGuidebook;

	public GuidebookPanel(MCreator mcreator, ModElement modElement) {
		super(new BorderLayout());
		this.modElement = modElement;

		GuidebookJavascriptBridge bridge = new GuidebookJavascriptBridge(mcreator);

		this.webView = new WebView("http://mcreator/patchouli/editor.html", false);
		this.webView.addLoadListener(() -> {
			webView.addJavaScriptBridge("javabridge", bridge);
			loaded = true;
			runAfterLoaded.forEach(Runnable::run);
			runAfterLoaded.clear();
		});

		add(webView, BorderLayout.CENTER);
	}

	public void openInEditingMode(Guidebook guidebook) {
		lastKnownGuidebook = guidebook;
		String encoded = Base64.getEncoder().encodeToString(guidebook.toJson().getBytes(StandardCharsets.UTF_8));
		runWhenLoaded(() -> webView.executeScript("window.loadGuidebookBase64('" + encoded + "');",
				WebView.JSExecutionType.LOCAL_SAFE));
	}

	public synchronized Guidebook getGuidebook() {
		if (loaded) {
			@Nullable String encoded = webView.executeScript("window.getGuidebookBase64()",
					WebView.JSExecutionType.RETURN_VALUE);

			if (encoded != null && !encoded.isBlank() && !encoded.equals("null")) {
				try {
					String json = new String(Base64.getDecoder().decode(encoded.trim()), StandardCharsets.UTF_8);
					lastKnownGuidebook = Guidebook.fromJson(json, modElement);
				} catch (Exception e) {
					LOG.error("Failed to read guidebook from the editor", e);
				}
			}
		}

		return lastKnownGuidebook != null ? lastKnownGuidebook : new Guidebook(modElement);
	}

	private void runWhenLoaded(Runnable runnable) {
		if (loaded)
			runnable.run();
		else
			runAfterLoaded.add(runnable);
	}

	@Override public void close() {
		webView.close();
	}

}