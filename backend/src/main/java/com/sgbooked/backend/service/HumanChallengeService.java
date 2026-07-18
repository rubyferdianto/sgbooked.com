package com.sgbooked.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.sgbooked.backend.model.AppModels.ChallengeTile;
import com.sgbooked.backend.model.AppModels.HumanChallenge;
import com.sgbooked.backend.model.AppModels.HumanChallengeResponse;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Service
public class HumanChallengeService {

	private final SecureRandom random = new SecureRandom();
	private final Map<String, HumanChallenge> challenges = new ConcurrentHashMap<>();

	public HumanChallengeResponse createChallenge(String prompt) {
		clearExpired();

		List<ChallengeTile> tiles = new ArrayList<>();
		int highlightedTile = random.nextInt(9) + 1;
		int expectedAnswer = 0;

		for (int tileNumber = 1; tileNumber <= 9; tileNumber++) {
			int ballCount = random.nextInt(5) + 1;
			boolean highlighted = tileNumber == highlightedTile;
			tiles.add(new ChallengeTile(tileNumber, ballCount, highlighted));
			if (highlighted) {
				expectedAnswer = ballCount;
			}
		}

		String challengeId = UUID.randomUUID().toString();
		HumanChallengeResponse response = new HumanChallengeResponse(challengeId, prompt, tiles);
		challenges.put(
			challengeId,
			new HumanChallenge(challengeId, expectedAnswer, Instant.now().plus(5, ChronoUnit.MINUTES), response));
		return response;
	}

	public void solve(String challengeId, int answer) {
		clearExpired();
		HumanChallenge challenge = challenges.remove(challengeId);

		if (challenge == null) {
			throw new ResponseStatusException(BAD_REQUEST, "The verification challenge has expired. Please try again.");
		}

		if (challenge.expiresAt().isBefore(Instant.now())) {
			throw new ResponseStatusException(BAD_REQUEST, "The verification challenge has expired. Please try again.");
		}

		if (challenge.expectedAnswer() != answer) {
			throw new ResponseStatusException(BAD_REQUEST, "Incorrect ball count. Please request a fresh verification.");
		}
	}

	private void clearExpired() {
		Instant now = Instant.now();
		challenges.entrySet().removeIf((entry) -> entry.getValue().expiresAt().isBefore(now));
	}
}