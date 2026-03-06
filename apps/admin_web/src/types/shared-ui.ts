export interface PaginatedListBaseProps {
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  onLoadMore: () => Promise<void> | void;
}

export interface CreateDialogBaseProps {
  open: boolean;
  isLoading: boolean;
  error: string;
  onClose: () => void;
}
