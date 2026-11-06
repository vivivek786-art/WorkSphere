package com.tracking.repository;

import com.tracking.model.MemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Collection;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {
    List<MemberEntity> findAllByWorkspace_IdOrderByNameAsc(Long workspaceId);
    java.util.Optional<MemberEntity> findByIdAndWorkspace_Id(Long id, Long workspaceId);
    @Query("select m from MemberEntity m where m.id in :ids and m.workspace.id = :workspaceId")
    List<MemberEntity> findAllByIdInAndWorkspace_Id(@Param("ids") Collection<Long> ids,
                                                    @Param("workspaceId") Long workspaceId);
}
