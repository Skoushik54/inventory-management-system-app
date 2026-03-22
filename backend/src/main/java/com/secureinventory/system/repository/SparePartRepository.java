package com.secureinventory.system.repository;

import com.secureinventory.system.entity.SparePart;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SparePartRepository extends JpaRepository<SparePart, Long> {
}
