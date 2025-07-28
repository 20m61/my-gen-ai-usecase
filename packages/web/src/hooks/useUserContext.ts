import { useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserContext {
  userId: string;
  email: string;
  groups: string[];
  department?: string;
  role?: string;
  permissions?: string[];
  attributes?: Record<string, string>;
}

interface UserContextState {
  userContext: UserContext | null;
  isLoading: boolean;
  error: string | null;
  setUserContext: (context: UserContext) => void;
  clearUserContext: () => void;
  updateGroups: (groups: string[]) => void;
  updateAttributes: (attributes: Record<string, string>) => void;
}

// Zustand store with persistence
const useUserContextStore = create<UserContextState>()(
  persist(
    (set) => ({
      userContext: null,
      isLoading: false,
      error: null,
      
      setUserContext: (context) => set({ userContext: context, error: null }),
      
      clearUserContext: () => set({ userContext: null, error: null }),
      
      updateGroups: (groups) => set((state) => ({
        userContext: state.userContext 
          ? { ...state.userContext, groups }
          : null,
      })),
      
      updateAttributes: (attributes) => set((state) => ({
        userContext: state.userContext
          ? { ...state.userContext, attributes: { ...state.userContext.attributes, ...attributes } }
          : null,
      })),
    }),
    {
      name: 'user-context-storage',
      partialize: (state) => ({ userContext: state.userContext }),
    }
  )
);

// Hook for managing user context
const useUserContext = () => {
  const {
    userContext,
    isLoading,
    error,
    setUserContext,
    clearUserContext,
    updateGroups,
    updateAttributes,
  } = useUserContextStore();

  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize user context from Cognito
  const initializeUserContext = async () => {
    try {
      useUserContextStore.setState({ isLoading: true, error: null });
      
      const session = await Auth.currentSession();
      const idToken = session.getIdToken();
      const payload = idToken.payload;
      
      // Extract user information from token
      const userId = payload.sub || '';
      const email = payload.email || '';
      const cognitoGroups = payload['cognito:groups'] || [];
      
      // Extract custom attributes
      const customAttributes: Record<string, string> = {};
      Object.keys(payload).forEach(key => {
        if (key.startsWith('custom:')) {
          customAttributes[key.replace('custom:', '')] = payload[key];
        }
      });
      
      const context: UserContext = {
        userId,
        email,
        groups: cognitoGroups,
        department: customAttributes.department,
        role: customAttributes.role,
        permissions: customAttributes.permissions?.split(',').filter(Boolean),
        attributes: customAttributes,
      };
      
      setUserContext(context);
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize user context:', err);
      useUserContextStore.setState({ 
        error: 'Failed to load user context',
        isLoading: false,
      });
    } finally {
      useUserContextStore.setState({ isLoading: false });
    }
  };

  // Initialize on mount if not already done
  useEffect(() => {
    if (!isInitialized && !userContext) {
      initializeUserContext();
    }
  }, [isInitialized, userContext]);

  // Listen for auth events
  useEffect(() => {
    const listener = (data: any) => {
      switch (data.payload.event) {
        case 'signIn':
          initializeUserContext();
          break;
        case 'signOut':
          clearUserContext();
          setIsInitialized(false);
          break;
        case 'tokenRefresh':
          initializeUserContext();
          break;
      }
    };

    const hubListener = Auth.Hub.listen('auth', listener);
    return () => hubListener();
  }, []);

  // Get formatted context for Kendra API
  const getKendraUserContext = () => {
    if (!userContext) return undefined;
    
    return {
      userId: userContext.userId,
      groups: userContext.groups,
      // Add additional context as needed
      token: JSON.stringify({
        department: userContext.department,
        role: userContext.role,
      }),
    };
  };

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    if (!userContext) return false;
    
    // Check direct permissions
    if (userContext.permissions?.includes(permission)) {
      return true;
    }
    
    // Check role-based permissions (customize based on your role structure)
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      manager: ['read', 'write', 'approve'],
      user: ['read'],
    };
    
    const userRole = userContext.role || 'user';
    const perms = rolePermissions[userRole] || [];
    
    return perms.includes('*') || perms.includes(permission);
  };

  // Check if user belongs to specific group
  const belongsToGroup = (group: string): boolean => {
    return userContext?.groups.includes(group) || false;
  };

  // Get filtered data based on user's department
  const filterByDepartment = <T extends { department?: string }>(
    items: T[]
  ): T[] => {
    if (!userContext?.department) return items;
    
    return items.filter(item => 
      !item.department || item.department === userContext.department
    );
  };

  return {
    userContext,
    isLoading,
    error,
    isInitialized,
    initializeUserContext,
    clearUserContext,
    updateGroups,
    updateAttributes,
    getKendraUserContext,
    hasPermission,
    belongsToGroup,
    filterByDepartment,
  };
};

// Hook for document-level access control
export const useDocumentAccess = () => {
  const { userContext, belongsToGroup, hasPermission } = useUserContext();

  // Build attribute filter for Kendra based on user context
  const buildAccessControlFilter = () => {
    if (!userContext) return undefined;
    
    const filters: any[] = [];
    
    // Filter by user groups
    if (userContext.groups.length > 0) {
      filters.push({
        OrAllFilters: userContext.groups.map(group => ({
          EqualsTo: {
            Key: '_group_ids',
            Value: { StringValue: group },
          },
        })),
      });
    }
    
    // Filter by department
    if (userContext.department) {
      filters.push({
        EqualsTo: {
          Key: '_department',
          Value: { StringValue: userContext.department },
        },
      });
    }
    
    // Filter by user ID for personal documents
    filters.push({
      OrAllFilters: [
        {
          EqualsTo: {
            Key: '_owner',
            Value: { StringValue: userContext.userId },
          },
        },
        {
          EqualsTo: {
            Key: '_acl_users',
            Value: { StringValue: userContext.userId },
          },
        },
      ],
    });
    
    // Combine all filters
    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0];
    
    return { OrAllFilters: filters };
  };

  // Check if user can access a specific document
  const canAccessDocument = (document: {
    owner?: string;
    groups?: string[];
    department?: string;
    public?: boolean;
  }): boolean => {
    // Public documents are accessible to all
    if (document.public) return true;
    
    // Check ownership
    if (document.owner === userContext?.userId) return true;
    
    // Check group membership
    if (document.groups?.some(group => belongsToGroup(group))) return true;
    
    // Check department
    if (document.department === userContext?.department) return true;
    
    // Check admin permission
    if (hasPermission('admin')) return true;
    
    return false;
  };

  return {
    buildAccessControlFilter,
    canAccessDocument,
  };
};

export default useUserContext;