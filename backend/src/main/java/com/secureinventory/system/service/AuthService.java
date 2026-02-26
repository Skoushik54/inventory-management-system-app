package com.secureinventory.system.service;

import com.secureinventory.system.entity.Admin;
import com.secureinventory.system.repository.AdminRepository;
import com.secureinventory.system.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public String login(String username, String password) {
        Admin admin = adminRepository.findByUsername(username)
                .orElseThrow(() -> {
                    auditLogService.log("LOGIN_FAILURE", "User not found: " + username);
                    return new RuntimeException("Invalid credentials");
                });

        if (admin.isAccountLocked()) {
            throw new RuntimeException("Account is locked");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));

            admin.setFailedAttempts(0);
            admin.setLastLogin(LocalDateTime.now());
            adminRepository.save(admin);

            auditLogService.log("LOGIN_SUCCESS", "Admin login: " + username);
            return jwtUtils.generateJwtToken(username);
        } catch (Exception e) {
            handleFailedLogin(admin);
            auditLogService.log("LOGIN_FAILURE", "Failed login attempt for: " + username);
            throw new RuntimeException("Invalid credentials");
        }
    }

    private void handleFailedLogin(Admin admin) {
        admin.setFailedAttempts(admin.getFailedAttempts() + 1);
        if (admin.getFailedAttempts() >= 5) {
            admin.setAccountLocked(true);
            admin.setLockTime(LocalDateTime.now());
        }
        adminRepository.save(admin);
    }
}
