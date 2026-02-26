package com.secureinventory.system.repository;

import com.secureinventory.system.entity.Officer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface OfficerRepository extends JpaRepository<Officer, Long> {
    Optional<Officer> findByBadgeNumber(String badgeNumber);
}
