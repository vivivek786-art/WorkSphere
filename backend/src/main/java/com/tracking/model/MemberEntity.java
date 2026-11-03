package com.tracking.model;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;

@Entity
@Table(name = "members")
public class MemberEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 3)
    private String initials;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id")
    private WorkspaceEntity workspace;

    protected MemberEntity() {
    }

    public MemberEntity(String name, String initials) {
        this.name = name;
        this.initials = initials;
    }

    public MemberEntity(String name, String initials, WorkspaceEntity workspace) {
        this.name = name;
        this.initials = initials;
        this.workspace = workspace;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getInitials() {
        return initials;
    }

    public WorkspaceEntity getWorkspace() {
        return workspace;
    }

    public void setWorkspace(WorkspaceEntity workspace) {
        this.workspace = workspace;
    }
}
