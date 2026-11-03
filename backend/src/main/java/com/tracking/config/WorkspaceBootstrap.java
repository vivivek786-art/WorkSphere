package com.tracking.config;

import com.tracking.model.AccountEntity;
import com.tracking.model.MemberEntity;
import com.tracking.model.ProjectEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.MemberRepository;
import com.tracking.repository.ProjectRepository;
import com.tracking.repository.WorkspaceRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class WorkspaceBootstrap implements ApplicationRunner {
    public static final String DEFAULT_WORKSPACE_NAME = "Workspace";

    private final WorkspaceRepository workspaces;
    private final AccountRepository accounts;
    private final ProjectRepository projects;
    private final MemberRepository members;

    public WorkspaceBootstrap(WorkspaceRepository workspaces, AccountRepository accounts,
                              ProjectRepository projects, MemberRepository members) {
        this.workspaces = workspaces;
        this.accounts = accounts;
        this.projects = projects;
        this.members = members;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (workspaces.count() != 0) return;

        WorkspaceEntity workspace = workspaces.save(new WorkspaceEntity(DEFAULT_WORKSPACE_NAME));
        for (AccountEntity account : accounts.findAll()) {
            workspace.addAccount(account);
        }
        for (ProjectEntity project : projects.findAll()) {
            project.setWorkspace(workspace);
        }
        for (MemberEntity member : members.findAll()) {
            member.setWorkspace(workspace);
        }
        workspaces.save(workspace);
        projects.flush();
        members.flush();
    }
}
