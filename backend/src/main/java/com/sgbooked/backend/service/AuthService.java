package com.sgbooked.backend.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.sgbooked.backend.model.AppModels.AuthCompleteResponse;
import com.sgbooked.backend.model.AppModels.HumanChallengeResponse;
import com.sgbooked.backend.model.AppModels.LoginRequest;
import com.sgbooked.backend.model.AppModels.PendingAuthResponse;
import com.sgbooked.backend.model.AppModels.PendingAuthSession;
import com.sgbooked.backend.model.AppModels.RegisterRequest;
import com.sgbooked.backend.model.AppModels.Role;
import com.sgbooked.backend.model.AppModels.UserAccount;
import com.sgbooked.backend.model.AppModels.UserResponse;
import com.sgbooked.backend.model.AppModels.VerifyHumanRequest;

import jakarta.annotation.PostConstruct;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AuthService {

	private final Map<String, UserAccount> usersByEmail = new ConcurrentHashMap<>();
	private final Map<String, PendingAuthSession> pendingSessions = new ConcurrentHashMap<>();
	private final Map<String, UserAccount> activeSessions = new ConcurrentHashMap<>();
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	private final HumanChallengeService humanChallengeService;
	private final NotificationService notificationService;

	public AuthService(HumanChallengeService humanChallengeService, NotificationService notificationService) {
		this.humanChallengeService = humanChallengeService;
		this.notificationService = notificationService;
	}

	@PostConstruct
	void seedAdmin() {
		String adminEmail = "admin@sgbooked.local";
		usersByEmail.put(
			adminEmail,
			new UserAccount(
				UUID.randomUUID().toString(),
				"SGBooked Admin",
				adminEmail,
				passwordEncoder.encode("ADMIN"),
				Role.ADMIN));
	}

	public PendingAuthResponse register(RegisterRequest request) {
		String fullName = requireText(request.fullName(), "Full name is required.");
		String email = normalizeEmail(request.email());
		String password = requirePassword(request.password());

		if (usersByEmail.containsKey(email)) {
			throw new ResponseStatusException(BAD_REQUEST, "An account with this email already exists.");
		}

		UserAccount account = new UserAccount(
			UUID.randomUUID().toString(),
			fullName,
			email,
			passwordEncoder.encode(password),
			Role.USER);
		usersByEmail.put(email, account);

		notificationService.sendAccessNotice(
			account,
			"sgbooked profile created",
			"Your sgbooked profile was created successfully. Complete the ball challenge to finish signing in.");

		return createPendingAuth(account, "Profile created. Complete the verification challenge to enter sgbooked.");
	}

	public PendingAuthResponse login(LoginRequest request) {
		String email = normalizeLoginIdentifier(request.email());
		String password = requireText(request.password(), "Password is required.");
		UserAccount account = usersByEmail.get(email);

		if (account == null || !passwordEncoder.matches(password, account.passwordHash())) {
			throw new ResponseStatusException(UNAUTHORIZED, "Incorrect email or password.");
		}

		notificationService.sendAccessNotice(
			account,
			"sgbooked login notice",
			"A successful login was started for your sgbooked account. Complete the ball challenge if this was you.");

		return createPendingAuth(account, "Login accepted. One more human verification challenge is required.");
	}

	public AuthCompleteResponse verifyHuman(VerifyHumanRequest request) {
		PendingAuthSession session = pendingSessions.remove(request.pendingToken());

		if (session == null || session.expiresAt().isBefore(Instant.now())) {
			throw new ResponseStatusException(BAD_REQUEST, "Your login session expired. Please sign in again.");
		}

		if (!session.challengeId().equals(request.challengeId())) {
			throw new ResponseStatusException(BAD_REQUEST, "Challenge mismatch. Please try again.");
		}

		humanChallengeService.solve(request.challengeId(), request.answer());

		UserAccount account = usersByEmail.get(session.userEmail());
		String token = UUID.randomUUID().toString();
		activeSessions.put(token, account);

		return new AuthCompleteResponse(
			"Verification complete. Welcome to sgbooked.",
			token,
			toUserResponse(account));
	}

	public UserAccount requireSession(String authorizationHeader) {
		String token = extractToken(authorizationHeader);
		UserAccount account = activeSessions.get(token);

		if (account == null) {
			throw new ResponseStatusException(UNAUTHORIZED, "You must sign in again.");
		}

		return account;
	}

	public UserAccount requireAdmin(String authorizationHeader) {
		UserAccount account = requireSession(authorizationHeader);

		if (account.role() != Role.ADMIN) {
			throw new ResponseStatusException(FORBIDDEN, "Admin access is required.");
		}

		return account;
	}

	public UserAccount requireCustomer(String authorizationHeader) {
		return requireSession(authorizationHeader);
	}

	private PendingAuthResponse createPendingAuth(UserAccount account, String message) {
		HumanChallengeResponse challenge = humanChallengeService.createChallenge(
			"The highlighted tile contains how many balls? Enter the number to continue.");
		String pendingToken = UUID.randomUUID().toString();
		pendingSessions.put(
			pendingToken,
			new PendingAuthSession(
				pendingToken,
				account.email(),
				challenge.challengeId(),
				Instant.now().plus(10, ChronoUnit.MINUTES)));
		return new PendingAuthResponse(message, pendingToken, challenge);
	}

	private String extractToken(String authorizationHeader) {
		if (!StringUtils.hasText(authorizationHeader) || !authorizationHeader.startsWith("Bearer ")) {
			throw new ResponseStatusException(UNAUTHORIZED, "Missing bearer token.");
		}

		return authorizationHeader.substring(7);
	}

	private String normalizeEmail(String email) {
		return requireText(email, "Email address is required.").toLowerCase(Locale.ROOT);
	}

	private String normalizeLoginIdentifier(String value) {
		String normalized = requireText(value, "Email address or username is required.");

		if ("ADMIN".equalsIgnoreCase(normalized)) {
			return "admin@sgbooked.local";
		}

		return normalized.toLowerCase(Locale.ROOT);
	}

	private String requirePassword(String password) {
		String value = requireText(password, "Password is required.");

		if (value.length() < 8) {
			throw new ResponseStatusException(BAD_REQUEST, "Password must be at least 8 characters.");
		}

		return value;
	}

	private String requireText(String value, String message) {
		if (!StringUtils.hasText(value)) {
			throw new ResponseStatusException(BAD_REQUEST, message);
		}

		return value.trim();
	}

	private UserResponse toUserResponse(UserAccount account) {
		return new UserResponse(account.fullName(), account.email(), account.role());
	}
}