import { useState, useCallback, useRef, DragEvent } from 'react';

export interface DragItem {
  id: string | number;
  type: string;
  data?: any;
}

export interface DropResult {
  item: DragItem;
  targetId: string | number | null;
  position?: 'before' | 'after' | 'inside';
}

export interface DragDropOptions {
  onDrop?: (result: DropResult) => void;
  onDragStart?: (item: DragItem) => void;
  onDragEnd?: () => void;
  onDragOver?: (item: DragItem, targetId: string | number | null) => void;
  dropTargetTypes?: string[];
  dragItemType?: string;
}

/**
 * Hook for managing drag and drop functionality
 */
export const useDragAndDrop = (options: DragDropOptions = {}) => {
  const {
    onDrop,
    onDragStart,
    onDragEnd,
    onDragOver,
    dropTargetTypes,
    dragItemType: _dragItemType = 'default'
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | number | null>(null);
  const dragCounterRef = useRef(0);

  const handleDragStart = useCallback((e: DragEvent<HTMLElement>, item: DragItem) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    
    // Set drag image if needed
    if (e.currentTarget) {
      // Add dragging class for styling
      e.currentTarget.classList.add('dragging');
    }
    
    setIsDragging(true);
    setDraggedItem(item);
    onDragStart?.(item);
  }, [onDragStart]);

  const handleDragEnd = useCallback((e: DragEvent<HTMLElement>) => {
    e.currentTarget.classList.remove('dragging');
    setIsDragging(false);
    setDraggedItem(null);
    setDropTarget(null);
    dragCounterRef.current = 0;
    onDragEnd?.();
  }, [onDragEnd]);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>, targetId: string | number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Check if we can drop here
    const data = e.dataTransfer.types.includes('application/json');
    if (!data) return;
    
    setDropTarget(targetId);
    if (draggedItem) {
      onDragOver?.(draggedItem, targetId);
    }
    
    // Handle drag enter/leave for visual feedback
    if (e.currentTarget !== e.target) {
      return;
    }
    
    dragCounterRef.current++;
    e.currentTarget.classList.add('drag-over');
  }, [draggedItem, onDragOver]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDropTarget(null);
      e.currentTarget.classList.remove('drag-over');
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLElement>, targetId: string | number | null) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const item: DragItem = JSON.parse(data);
        
        // Validate drop target type if specified
        if (dropTargetTypes && dropTargetTypes.length > 0) {
          // Allow drop if no specific types required or item type matches
          const isValid = dropTargetTypes.includes(item.type) || dropTargetTypes.includes('*');
          if (!isValid) return;
        }
        
        const result: DropResult = {
          item,
          targetId,
          position: 'inside'
        };
        
        onDrop?.(result);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
    
    setIsDragging(false);
    setDraggedItem(null);
    setDropTarget(null);
    dragCounterRef.current = 0;
  }, [onDrop, dropTargetTypes]);

  return {
    isDragging,
    draggedItem,
    dropTarget,
    handlers: {
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  };
};

/**
 * Hook for managing multiple item selection drag
 */
export const useMultiDragSelect = (
  items: any[],
  selectedIds: Set<number | string>,
  onSelect: (ids: Set<number | string>) => void,
  idField: string = 'id'
) => {
  const isDraggingRef = useRef(false);
  const startItemRef = useRef<any>(null);

  const handleDragStart = useCallback((item: any) => {
    if (!selectedIds.has(item[idField])) {
      // Start new selection
      onSelect(new Set([item[idField]]));
    }
    isDraggingRef.current = true;
    startItemRef.current = item;
  }, [selectedIds, onSelect, idField]);

  const handleDragEnter = useCallback((item: any) => {
    if (!isDraggingRef.current || !startItemRef.current) return;
    
    // Find start and end indices
    const startIdx = items.findIndex(i => i[idField] === startItemRef.current[idField]);
    const endIdx = items.findIndex(i => i[idField] === item[idField]);
    
    if (startIdx === -1 || endIdx === -1) return;
    
    // Select all items between start and end
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    
    const newSelection = new Set(selectedIds);
    for (let i = minIdx; i <= maxIdx; i++) {
      newSelection.add(items[i][idField]);
    }
    onSelect(newSelection);
  }, [items, selectedIds, onSelect, idField]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    startItemRef.current = null;
  }, []);

  return {
    handleDragStart,
    handleDragEnter,
    handleDragEnd
  };
};

export default useDragAndDrop;
