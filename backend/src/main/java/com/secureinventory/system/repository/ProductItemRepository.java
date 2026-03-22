package com.secureinventory.system.repository;

import com.secureinventory.system.entity.ProductItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProductItemRepository extends JpaRepository<ProductItem, Long> {
    Optional<ProductItem> findByBarcode(String barcode);
    long countByProductId(Long productId);
    long countByProductIdAndStatus(Long productId, ProductItem.Status status);
    java.util.List<ProductItem> findByProductIdAndStatus(Long productId, ProductItem.Status status);
    long countByStatus(ProductItem.Status status);
    java.util.List<ProductItem> findByStatus(ProductItem.Status status);
    java.util.List<ProductItem> findByStatusIn(java.util.List<ProductItem.Status> statuses);
}
