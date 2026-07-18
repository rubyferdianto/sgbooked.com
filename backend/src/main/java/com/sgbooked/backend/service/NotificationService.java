package com.sgbooked.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.sgbooked.backend.config.SgBookedProperties;
import com.sgbooked.backend.model.AppModels.UserAccount;

@Service
public class NotificationService {

	private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

	private final JavaMailSender mailSender;
	private final SgBookedProperties properties;
	private final Environment environment;

	public NotificationService(
		ObjectProvider<JavaMailSender> mailSenderProvider,
		SgBookedProperties properties,
		Environment environment) {
		this.mailSender = mailSenderProvider.getIfAvailable();
		this.properties = properties;
		this.environment = environment;
	}

	public void sendAccessNotice(UserAccount user, String subjectLine, String body) {
		if (!properties.getMail().isEnabled() || mailSender == null) {
			logger.info("Mail disabled. Would send '{}' to {} with body: {}", subjectLine, user.email(), body);
			return;
		}

		if (isLocalOnlyRecipient(user.email())) {
			logger.info("Skipping SMTP for local-only demo account {}.", user.email());
			return;
		}

		if (!hasUsableSmtpCredentials()) {
			logger.info("Skipping SMTP because Gmail credentials are not configured for local development.");
			return;
		}

		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom(properties.getMail().getFrom());
		message.setTo(user.email());
		message.setSubject(subjectLine);
		message.setText(body);

		try {
			mailSender.send(message);
		} catch (Exception exception) {
			logger.warn("Unable to deliver SMTP message to {}: {}", user.email(), exception.getMessage());
		}
	}

	private boolean hasUsableSmtpCredentials() {
		String username = environment.getProperty("spring.mail.username");
		String password = environment.getProperty("spring.mail.password");

		return StringUtils.hasText(username) && StringUtils.hasText(password);
	}

	private boolean isLocalOnlyRecipient(String emailAddress) {
		return StringUtils.hasText(emailAddress) && emailAddress.toLowerCase().endsWith(".local");
	}
}