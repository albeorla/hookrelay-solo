import { useState, useEffect, useCallback, useMemo } from "react";
// removed unused UseQueryOptions/UseQueryResult types

// Debounced value hook for search inputs
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized query options for different scenarios
export const QueryOptimizations = {
  // Fast refresh for critical data
  realtime: {
    refetchInterval: 5000,
    staleTime: 2000,
    cacheTime: 30000,
  },

  // Standard refresh for dashboard data
  dashboard: {
    refetchInterval: 30000,
    staleTime: 10000,
    cacheTime: 300000, // 5 minutes
  },

  // Slow refresh for configuration data
  config: {
    refetchInterval: false,
    staleTime: 600000, // 10 minutes
    cacheTime: 1800000, // 30 minutes
  },

  // Analytics data (updated less frequently)
  analytics: {
    refetchInterval: 60000,
    staleTime: 30000,
    cacheTime: 600000, // 10 minutes
  },

  // Static data (endpoints, settings)
  static: {
    refetchInterval: false,
    staleTime: Infinity,
    cacheTime: 3600000, // 1 hour
  },
} as const;

// Hook for managing loading states across multiple queries
export function useLoadingState(
  queries: Array<{ isLoading?: boolean; isFetching?: boolean }>,
) {
  return useMemo(() => {
    const isInitialLoading = queries.some((q) => q.isLoading);
    const isFetching = queries.some((q) => q.isFetching);
    const isIdle = queries.every((q) => !q.isLoading && !q.isFetching);

    return {
      isInitialLoading,
      isFetching,
      isIdle,
      loadingCount: queries.filter((q) => q.isLoading).length,
      fetchingCount: queries.filter((q) => q.isFetching).length,
    };
  }, [queries]);
}

// Hook for optimized search with debouncing and empty state handling
export function useOptimizedSearch(initialValue = "", debounceMs = 300) {
  const [searchInput, setSearchInput] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounced(searchInput, debounceMs);

  useEffect(() => {
    if (searchInput !== debouncedSearch) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchInput, debouncedSearch]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
  }, []);

  const hasSearch = useMemo(() => {
    return debouncedSearch.trim().length > 0;
  }, [debouncedSearch]);

  return {
    searchInput,
    setSearchInput,
    debouncedSearch,
    isSearching,
    hasSearch,
    clearSearch,
  };
}

// Hook for managing filter state with performance optimizations
export function useOptimizedFilters<T extends Record<string, unknown>>(
  initialFilters: T,
) {
  const [filters, setFilters] = useState<T>(initialFilters);
  const [isFiltering, setIsFiltering] = useState(false);

  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setIsFiltering(true);
    setFilters((prev) => ({ ...prev, [key]: value }));

    // Reset filtering state after a short delay
    setTimeout(() => setIsFiltering(false), 100);
  }, []);

  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setIsFiltering(true);
    setFilters((prev) => ({ ...prev, ...newFilters }));

    setTimeout(() => setIsFiltering(false), 100);
  }, []);

  const resetFilters = useCallback(() => {
    setIsFiltering(true);
    setFilters(initialFilters);

    setTimeout(() => setIsFiltering(false), 100);
  }, [initialFilters]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initialValue = initialFilters[key as keyof T];
      return JSON.stringify(value) !== JSON.stringify(initialValue);
    });
  }, [filters, initialFilters]);

  return {
    filters,
    setFilters,
    updateFilter,
    updateFilters,
    resetFilters,
    isFiltering,
    hasActiveFilters,
  };
}

// Hook for managing bulk selections with performance optimizations
export function useOptimizedSelection<T = string>(initialSelection: T[] = []) {
  const [selected, setSelected] = useState<T[]>(initialSelection);
  const [isSelecting, setIsSelecting] = useState(false);

  const toggleItem = useCallback((item: T) => {
    setIsSelecting(true);
    setSelected((prev) => {
      const isSelected = prev.includes(item);
      const newSelection = isSelected
        ? prev.filter((i) => i !== item)
        : [...prev, item];

      setTimeout(() => setIsSelecting(false), 50);
      return newSelection;
    });
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setIsSelecting(true);
    setSelected(items);
    setTimeout(() => setIsSelecting(false), 50);
  }, []);

  const selectNone = useCallback(() => {
    setIsSelecting(true);
    setSelected([]);
    setTimeout(() => setIsSelecting(false), 50);
  }, []);

  const isSelected = useCallback(
    (item: T) => selected.includes(item),
    [selected],
  );

  const isAllSelected = useCallback(
    (items: T[]) => {
      return items.length > 0 && items.every((item) => selected.includes(item));
    },
    [selected],
  );

  const selectedCount = useMemo(() => selected.length, [selected]);
  const hasSelection = useMemo(() => selected.length > 0, [selected]);

  return {
    selected,
    setSelected,
    toggleItem,
    selectAll,
    selectNone,
    isSelected,
    isAllSelected,
    selectedCount,
    hasSelection,
    isSelecting,
  };
}

// Intersection observer hook for infinite scrolling/lazy loading
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry!.isIntersecting;
        setIsIntersecting(intersecting);

        if (intersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "10px",
        ...options,
      },
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, hasIntersected, options]);

  return { isIntersecting, hasIntersected };
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    setRenderCount((prev) => prev + 1);

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      setLastRenderTime(renderTime);

      if (process.env.NODE_ENV === "development" && renderTime > 100) {
        console.warn(
          `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
        );
      }
    };
  }, [componentName]);

  return { renderCount, lastRenderTime };
}
