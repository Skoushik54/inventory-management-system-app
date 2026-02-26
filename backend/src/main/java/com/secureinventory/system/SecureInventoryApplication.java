package com.secureinventory.system;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.CommandLineRunner;
import com.secureinventory.system.entity.Admin;
import com.secureinventory.system.repository.AdminRepository;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class SecureInventoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecureInventoryApplication.class, args);
    }

    @Bean
    public CommandLineRunner initData(AdminRepository adminRepository) {
        return args -> {
            // FORCE RESET: Delete any existing admin to clear locks/bad passwords
            adminRepository.findByUsername("admin").ifPresent(adminRepository::delete);
            
            Admin admin = new Admin();
            admin.setUsername("admin");
            admin.setPasswordHash("password123");
            admin.setAccountLocked(false);
            admin.setFailedAttempts(0);
            adminRepository.save(admin);
            System.out.println(">>> CLOUD ADMIN RESET: admin / password123");
        };
    }
}
