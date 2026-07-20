package com.sgbooked.backend.controller;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

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

import com.sgbooked.backend.model.AppModels.ReleaseSeatsRequest;
import com.sgbooked.backend.model.AppModels.StandardMessageResponse;
import com.sgbooked.backend.service.AuthService;
import com.sgbooked.backend.service.BookingService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

	private static final Map<String, String> EVENT_IMAGE_FILES = Map.of(
		"FOC", "FOC.png",
		"CRN", "CRN.png",
		"CCS", "CCS.png",
		"INDIE_NIGHT", "indie_night.png",
		"JAZZ_COURTYARD", "jazz_courtyard.png",
		"SPRING_BEATS_FESTIVAL", "spring_beats_festival.png",
		"ACOUSTIC_SUNSET", "acoustic_sunset.png");

	private final AuthService authService;
	private final BookingService bookingService;

	public AdminController(AuthService authService, BookingService bookingService) {
		this.authService = authService;
		this.bookingService = bookingService;
	}

	@PostMapping("/release")
	public StandardMessageResponse releaseSeats(
		@RequestHeader("Authorization") String authorizationHeader,
		@RequestBody ReleaseSeatsRequest request) {
		authService.requireAdmin(authorizationHeader);
		return bookingService.setReleased(request.released());
	}

	@GetMapping("/event-images/{name}")
	public ResponseEntity<Resource> eventImage(@PathVariable String name) {
		String baseName = name.replaceAll("(?i)\\.png$", "").toUpperCase();
		String fileName = EVENT_IMAGE_FILES.get(baseName);
		if (fileName == null) {
			throw new ResponseStatusException(BAD_REQUEST, "Unknown event image.");
		}
		Path path = Paths.get("dummy_images", fileName).normalize();
		Resource resource;
		try {
			resource = new UrlResource(path.toUri());
		} catch (MalformedURLException ex) {
			throw new ResponseStatusException(BAD_REQUEST, "Invalid path.");
		}
		if (!resource.exists() || !resource.isReadable()) {
			throw new ResponseStatusException(NOT_FOUND, "Event image not found.");
		}
		return ResponseEntity.ok()
			.contentType(MediaType.IMAGE_PNG)
			.header("Cache-Control", "public, max-age=86400")
			.body(resource);
	}
}
