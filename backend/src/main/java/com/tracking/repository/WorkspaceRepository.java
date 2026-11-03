package com.tracking.repository;

import com.tracking.model.WorkspaceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkspaceRepository extends JpaRepository<WorkspaceEntity, Long> {
    Optional<WorkspaceEntity> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
    boolean existsByIdAndAccounts_UsernameIgnoreCase(Long id, String username);
    List<WorkspaceEntity> findAllByAccounts_UsernameIgnoreCaseOrderByNameAsc(String username);
    List<WorkspaceEntity> findAllByOrderByNameAsc();
}
