package com.tracking.repository;

import com.tracking.model.AccountEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<AccountEntity, Long> {
    Optional<AccountEntity> findByUsernameIgnoreCase(String username);
    boolean existsByUsernameIgnoreCase(String username);
    List<AccountEntity> findAllByOrderByFullNameAsc();
    long countByRoleAndEnabledTrue(String role);
}
