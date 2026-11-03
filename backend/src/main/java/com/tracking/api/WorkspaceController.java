package com.tracking.api;

import com.tracking.model.AccountEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.WorkspaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Validated
@RestController
@RequestMapping("/common/api/v1")
public class WorkspaceController {
    private final WorkspaceRepository workspaces;
    private final AccountRepository accounts;

    public WorkspaceController(WorkspaceRepository workspaces, AccountRepository accounts) {
        this.workspaces = workspaces;
        this.accounts = accounts;
    }

    @GetMapping("/workspaces")
    @Transactional(readOnly = true)
    public List<ApiModels.WorkspaceResponse> getWorkspaces(Authentication authentication) {
        return workspaces.findAllByAccounts_UsernameIgnoreCaseOrderByNameAsc(authentication.getName()).stream()
                .map(ApiModels.WorkspaceResponse::new)
                .collect(Collectors.toList());
    }

    @GetMapping("/admin/workspaces")
    @Transactional(readOnly = true)
    public List<ApiModels.AdminWorkspaceResponse> getAllWorkspaces() {
        return workspaces.findAllByOrderByNameAsc().stream()
                .map(ApiModels.AdminWorkspaceResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping("/admin/workspaces")
    @Transactional
    public ApiModels.AdminWorkspaceResponse createWorkspace(@Valid @RequestBody ApiModels.WorkspaceRequest request,
                                                             Authentication authentication) {
        String name = request.name.trim();
        if (workspaces.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A workspace with that name already exists.");
        }
        WorkspaceEntity workspace = new WorkspaceEntity(name);
        workspace.replaceAccounts(resolveAccounts(request.accountIds, authentication));
        return new ApiModels.AdminWorkspaceResponse(workspaces.save(workspace));
    }

    @PutMapping("/admin/workspaces/{workspaceId}/accounts")
    @Transactional
    public ApiModels.AdminWorkspaceResponse updateWorkspaceAccounts(
            @PathVariable Long workspaceId,
            @Valid @RequestBody ApiModels.WorkspaceRequest request,
            Authentication authentication) {
        WorkspaceEntity workspace = workspaces.findById(workspaceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found."));
        String name = request.name.trim();
        workspaces.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (!existing.getId().equals(workspaceId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A workspace with that name already exists.");
            }
        });
        workspace.replaceAccounts(resolveAccounts(request.accountIds, authentication));
        return new ApiModels.AdminWorkspaceResponse(workspaces.save(workspace));
    }

    private Set<AccountEntity> resolveAccounts(List<Long> accountIds, Authentication authentication) {
        Set<Long> requestedIds = new LinkedHashSet<>(accountIds == null ? new ArrayList<>() : accountIds);
        AccountEntity currentAccount = accounts.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found."));
        requestedIds.add(currentAccount.getId());

        List<AccountEntity> selectedAccounts = accounts.findAllById(requestedIds);
        if (selectedAccounts.size() != requestedIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "One or more selected accounts were not found.");
        }
        return new LinkedHashSet<>(selectedAccounts);
    }
}
