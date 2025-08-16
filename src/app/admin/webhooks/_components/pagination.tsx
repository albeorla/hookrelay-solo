"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
  showPageSizeSelector?: boolean;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  showPageSizeSelector = true,
  className = "",
}: PaginationProps) {
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      const startPage = Math.max(2, currentPage - 2);
      const endPage = Math.min(totalPages - 1, currentPage + 2);

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push("...");
      }

      // Add pages around current page
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push("...");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pages = generatePageNumbers();
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems ?? 0);

  if (totalPages <= 1 && !showPageSizeSelector) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-4">
        {totalItems !== undefined && (
          <div className="text-muted-foreground text-sm">
            Showing {startItem}-{endItem} of {totalItems} results
          </div>
        )}

        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Rows per page</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={!hasPreviousPage || isLoading}
            className="h-8 w-8 p-0"
          >
            <ChevronsLeft className="h-4 w-4" />
            <span className="sr-only">Go to first page</span>
          </Button>

          {/* Previous page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage || isLoading}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Go to previous page</span>
          </Button>

          {/* Page numbers */}
          {pages.map((page, index) => (
            <React.Fragment key={index}>
              {page === "..." ? (
                <div className="flex h-8 w-8 items-center justify-center">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
              ) : (
                <Button
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </Button>
              )}
            </React.Fragment>
          ))}

          {/* Next page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage || isLoading}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Go to next page</span>
          </Button>

          {/* Last page button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNextPage || isLoading}
            className="h-8 w-8 p-0"
          >
            <ChevronsRight className="h-4 w-4" />
            <span className="sr-only">Go to last page</span>
          </Button>
        </div>
      )}
    </div>
  );
}

// Hook for managing pagination state with DynamoDB keys
type PageKey = { endpoint_id: string; delivery_id: string } | null;

export function usePagination(pageSize = 20) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageKeys, setPageKeys] = React.useState<Array<PageKey>>([null]); // Store DynamoDB keys for each page
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalItems, setTotalItems] = React.useState<number | undefined>();

  const getCurrentPageKey = () => {
    return pageKeys[currentPage - 1] ?? null;
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (_newPageSize: number) => {
    // Reset pagination when page size changes
    setCurrentPage(1);
    setPageKeys([null]);
    setTotalPages(1);
    setTotalItems(undefined);
  };

  const updatePaginationData = (data: {
    items: unknown[];
    lastEvaluatedKey?: PageKey;
    hasMore?: boolean;
    totalCount?: number;
  }) => {
    const { lastEvaluatedKey, hasMore, totalCount } = data;

    // Update page keys for next page navigation
    if (lastEvaluatedKey && hasMore) {
      const newPageKeys = [...pageKeys];

      // Add the key for the next page if it doesn't exist
      if (newPageKeys.length === currentPage) {
        newPageKeys.push(lastEvaluatedKey);
      }

      setPageKeys(newPageKeys);

      // Update total pages (estimate based on having more data)
      if (totalCount) {
        setTotalPages(Math.ceil(totalCount / pageSize));
        setTotalItems(totalCount);
      } else {
        // Conservative estimate - we know there's at least one more page
        setTotalPages(Math.max(totalPages, currentPage + 1));
      }
    } else {
      // No more pages available
      setTotalPages(currentPage);
    }

    if (totalCount !== undefined) {
      setTotalItems(totalCount);
    }
  };

  const reset = () => {
    setCurrentPage(1);
    setPageKeys([null]);
    setTotalPages(1);
    setTotalItems(undefined);
  };

  return {
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    getCurrentPageKey,
    handlePageChange,
    handlePageSizeChange,
    updatePaginationData,
    reset,
  };
}
