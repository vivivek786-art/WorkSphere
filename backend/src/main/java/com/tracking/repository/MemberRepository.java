package com.tracking.repository;

import com.tracking.model.MemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {
    List<MemberEntity> findAllByWorkspace_IdOrderByNameAsc(Long workspaceId);
    java.util.Optional<MemberEntity> findByIdAndWorkspace_Id(Long id, Long workspaceId);
}
