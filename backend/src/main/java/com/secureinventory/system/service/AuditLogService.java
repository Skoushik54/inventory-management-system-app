package com.secureinventory.system.service;

import com.secureinventory.system.entity.AuditLog;
import com.secureinventory.system.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private HttpServletRequest request;

    @Transactional
    public void log(String action, String description) {
        String ipAddress = request.getRemoteAddr();
        AuditLog auditLog = new AuditLog(action, description, ipAddress);
        auditLogRepository.save(auditLog);
    }
}
