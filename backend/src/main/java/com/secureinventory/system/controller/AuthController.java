package com.secureinventory.system.controller;

import com.secureinventory.system.dto.InventoryDtos;
import com.secureinventory.system.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.security.Principal;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody InventoryDtos.LoginRequest loginRequest) {
        String token = authService.login(loginRequest.getUsername(), loginRequest.getPassword());
        InventoryDtos.LoginResponse response = new InventoryDtos.LoginResponse();
        response.setToken(token);
        response.setUsername(loginRequest.getUsername());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-password")
    public ResponseEntity<?> verifyPassword(@RequestBody Map<String, String> request, Principal principal) {
        if (principal == null || principal.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        boolean isValid = authService.verifyPassword(principal.getName(), request.get("password"));
        if (!isValid) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Incorrect password"));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Password verified"));
    }
}
