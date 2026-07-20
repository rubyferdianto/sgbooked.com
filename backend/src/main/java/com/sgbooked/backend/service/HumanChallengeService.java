package com.sgbooked.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.sgbooked.backend.model.AppModels.ChallengeTile;
import com.sgbooked.backend.model.AppModels.HumanChallenge;
import com.sgbooked.backend.model.AppModels.HumanChallengeResponse;

@Service
public class HumanChallengeService {

	private final SecureRandom random = new SecureRandom();
	private final Map<String, HumanChallenge> challenges = new ConcurrentHashMap<>();
	private static final Map<String, Integer> IMAGE_ANSWER_BY_HASH = createImageAnswerLookup();
	private static final String IMAGE_BASE_PATH = "/api/auth/challenge-images/";

	public HumanChallengeResponse createChallenge(String prompt) {
		clearExpired();

		List<String> imageNames = new ArrayList<>(IMAGE_ANSWER_BY_HASH.keySet());
		Collections.shuffle(imageNames, random);

		List<ChallengeTile> tiles = new ArrayList<>();
		int highlightedTile = random.nextInt(imageNames.size()) + 1;
		int expectedAnswer = 0;

		for (int tileNumber = 1; tileNumber <= imageNames.size(); tileNumber++) {
			String imageName = imageNames.get(tileNumber - 1);
			boolean highlighted = tileNumber == highlightedTile;
			tiles.add(new ChallengeTile(tileNumber, IMAGE_BASE_PATH + imageName, highlighted));
			if (highlighted) {
				expectedAnswer = IMAGE_ANSWER_BY_HASH.get(imageName);
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

		ChallengeTile highlightedTile = challenge.response().tiles().stream()
			.filter(ChallengeTile::highlighted)
			.findFirst()
			.orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "No highlighted tile found."));

		String imageUrl = highlightedTile.imageUrl();
		String filename = imageUrl.substring(imageUrl.lastIndexOf("/") + 1);
		String inputHash = sha256(String.valueOf(answer)) + ".png";

		if (!filename.equalsIgnoreCase(inputHash)) {
			throw new ResponseStatusException(BAD_REQUEST, "Incorrect ball count. Please request a fresh verification.");
		}
	}

	private String sha256(String base) {
		try {
			java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(base.getBytes(java.nio.charset.StandardCharsets.UTF_8));
			StringBuilder hexString = new StringBuilder();
			for (byte b : hash) {
				String hex = Integer.toHexString(0xff & b);
				if (hex.length() == 1) {
					hexString.append('0');
				}
				hexString.append(hex);
			}
			return hexString.toString();
		} catch (java.security.NoSuchAlgorithmException ex) {
			throw new RuntimeException(ex);
		}
	}

	private void clearExpired() {
		Instant now = Instant.now();
		challenges.entrySet().removeIf((entry) -> entry.getValue().expiresAt().isBefore(now));
	}

	private static Map<String, Integer> createImageAnswerLookup() {
		Map<String, Integer> lookup = new HashMap<>();
		lookup.put("6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b.png", 1);
		lookup.put("d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35.png", 2);
		lookup.put("4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce.png", 3);
		lookup.put("4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a.png", 4);
		lookup.put("ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d.png", 5);
		return Map.copyOf(lookup);
	}
}