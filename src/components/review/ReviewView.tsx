import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { ConversationViewer } from './ConversationViewer';
import { RatingPanel } from './RatingPanel';

export function ReviewView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setSelectedId(id);
    }
  }, [searchParams]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSearchParams({ id });
  };

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList selectedId={selectedId} onSelect={handleSelect} />
      <ConversationViewer conversationId={selectedId} />
      <RatingPanel conversationId={selectedId} />
    </div>
  );
}
