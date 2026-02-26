package com.secureinventory.system.repository;

import com.secureinventory.system.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByBarcode(String barcode);
    java.util.List<Product> findAllByOrderByOrderIndexAsc();
}
