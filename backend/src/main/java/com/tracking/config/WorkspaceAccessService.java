package com.tracking.config;

import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.WorkspaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkspaceAccessService {
    private final WorkspaceRepository workspaces;

    public WorkspaceAccessService(WorkspaceRepository workspaces) {
        this.workspaces = workspaces;
    }

    public WorkspaceEntity requireWorkspace(Long workspaceId, Authentication authentication) {
        if (workspaceId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a workspace first.");
        }
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to access this workspace.");
        }
        WorkspaceEntity workspace = workspaces.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found."));
        if (!workspaces.existsByIdAndAccounts_UsernameIgnoreCase(workspaceId, authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this workspace.");
        }
        return workspace;
    }
}
