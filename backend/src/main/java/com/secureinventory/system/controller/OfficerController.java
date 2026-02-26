package com.secureinventory.system.controller;

import com.secureinventory.system.entity.Officer;
import com.secureinventory.system.repository.OfficerRepository;
import com.secureinventory.system.repository.TransactionRepository;
import com.secureinventory.system.service.AuditLogService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/officers")
public class OfficerController {

    @Autowired
    private OfficerRepository officerRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private AuditLogService auditLogService;

    @PostMapping
    public ResponseEntity<Officer> addOfficer(@RequestBody Officer officer) {
        Officer saved = officerRepository.save(officer);
        auditLogService.log("OFFICER_ADD",
                "Added officer: " + officer.getName() + " with badge: " + officer.getBadgeNumber());
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<Officer>> getAllOfficers() {
        return ResponseEntity.ok(officerRepository.findAll());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Officer> updateOfficer(@PathVariable Long id, @RequestBody Officer officer) {
        Officer existing = officerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Officer not found"));
        existing.setName(officer.getName());
        existing.setBadgeNumber(officer.getBadgeNumber());
        existing.setDepartment(officer.getDepartment());
        existing.setPhone(officer.getPhone());
        existing.setIdCardUrl(officer.getIdCardUrl());
        Officer saved = officerRepository.save(existing);
        auditLogService.log("OFFICER_UPDATE", "Updated officer: " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteOfficer(@PathVariable Long id) {
        Officer officer = officerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Officer not found"));
        
        // Delete all transactions for this officer first
        transactionRepository.findAll().stream()
            .filter(t -> t.getOfficer().getId().equals(id))
            .forEach(t -> transactionRepository.delete(t));

        officerRepository.delete(officer);
        auditLogService.log("OFFICER_DELETE", "Deleted officer: " + officer.getName());
        return ResponseEntity.ok().build();
    }
}
