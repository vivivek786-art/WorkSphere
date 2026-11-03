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
@Table(name = "projects")
public class ProjectEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "project_key", nullable = false, unique = true, length = 12)
    private String projectKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workspace_id")
    private WorkspaceEntity workspace;

    protected ProjectEntity() {
    }

    public ProjectEntity(String name, String projectKey) {
        this.name = name;
        this.projectKey = projectKey;
    }

    public ProjectEntity(String name, String projectKey, WorkspaceEntity workspace) {
        this.name = name;
        this.projectKey = projectKey;
        this.workspace = workspace;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getProjectKey() {
        return projectKey;
    }

    public WorkspaceEntity getWorkspace() {
        return workspace;
    }

    public void setWorkspace(WorkspaceEntity workspace) {
        this.workspace = workspace;
    }
}
