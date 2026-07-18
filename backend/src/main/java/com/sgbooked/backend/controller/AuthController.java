package com.sgbooked.backend.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.sgbooked.backend.model.AppModels.AuthCompleteResponse;
import com.sgbooked.backend.model.AppModels.LoginRequest;
import com.sgbooked.backend.model.AppModels.PendingAuthResponse;
import com.sgbooked.backend.model.AppModels.RegisterRequest;
import com.sgbooked.backend.model.AppModels.VerifyHumanRequest;
import com.sgbooked.backend.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

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
}