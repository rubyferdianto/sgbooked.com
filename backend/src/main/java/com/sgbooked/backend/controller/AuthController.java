package com.sgbooked.backend.controller;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Pattern;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.sgbooked.backend.model.AppModels.AuthCompleteResponse;
import com.sgbooked.backend.model.AppModels.ChangePasswordRequest;
import com.sgbooked.backend.model.AppModels.LoginRequest;
import com.sgbooked.backend.model.AppModels.PendingAuthResponse;
import com.sgbooked.backend.model.AppModels.RegisterRequest;
import com.sgbooked.backend.model.AppModels.StandardMessageResponse;
import com.sgbooked.backend.model.AppModels.VerifyHumanRequest;
import com.sgbooked.backend.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;
	private static final Pattern IMAGE_NAME_PATTERN = Pattern.compile("^[a-f0-9]{64}\\.png$");

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/register")
	public PendingAuthResponse register(@RequestBody RegisterRequest request) {
		return authService.register(request);
	}

	@PostMapping("/login")
	public PendingAuthResponse login(@RequestBody LoginRequest request) {
		return authService.login(request);
	}

	@PostMapping("/verify-human")
	public AuthCompleteResponse verifyHuman(@RequestBody VerifyHumanRequest request) {
		return authService.verifyHuman(request);
	}

	@PostMapping("/change-password")
	public StandardMessageResponse changePassword(
		@RequestHeader("Authorization") String authorizationHeader,
		@RequestBody ChangePasswordRequest request) {
		return authService.changePassword(authorizationHeader, request);
	}

	@GetMapping("/challenge-images/{imageName}")
	public ResponseEntity<Resource> challengeImage(@PathVariable String imageName) {
		if (!IMAGE_NAME_PATTERN.matcher(imageName).matches()) {
			throw new ResponseStatusException(BAD_REQUEST, "Invalid image name.");
		}

		Path path = Paths.get("dummy_images", imageName).normalize();
		Resource resource;

		try {
			resource = new UrlResource(path.toUri());
		} catch (MalformedURLException ex) {
			throw new ResponseStatusException(BAD_REQUEST, "Invalid image path.");
		}

		if (!resource.exists() || !resource.isReadable()) {
			throw new ResponseStatusException(NOT_FOUND, "Challenge image not found.");
		}

		return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(resource);
	}
}