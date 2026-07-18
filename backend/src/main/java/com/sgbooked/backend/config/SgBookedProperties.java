package com.sgbooked.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sgbooked")
public class SgBookedProperties {

	private String frontendOrigin = "http://localhost:5173";
	private int holdMinutes = 10;
	private int extensionMinutes = 10;
	private final Mail mail = new Mail();

	public String getFrontendOrigin() {
		return frontendOrigin;
	}

	public void setFrontendOrigin(String frontendOrigin) {
		this.frontendOrigin = frontendOrigin;
	}

	public int getHoldMinutes() {
		return holdMinutes;
	}

	public void setHoldMinutes(int holdMinutes) {
		this.holdMinutes = holdMinutes;
	}

	public int getExtensionMinutes() {
		return extensionMinutes;
	}

	public void setExtensionMinutes(int extensionMinutes) {
		this.extensionMinutes = extensionMinutes;
	}

	public Mail getMail() {
		return mail;
	}

	public static class Mail {

		private boolean enabled;
		private String from = "no-reply@sgbooked.local";

		public boolean isEnabled() {
			return enabled;
		}

		public void setEnabled(boolean enabled) {
			this.enabled = enabled;
		}

		public String getFrom() {
			return from;
		}

		public void setFrom(String from) {
			this.from = from;
		}
	}
}