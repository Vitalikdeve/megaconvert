import React from 'react';
import MegaDrop from '../components/MegaDrop.jsx';

export default function SecureSharePage({ preparedFile = null, onPreparedFileConsumed = null }) {
  return (
    <MegaDrop initialFile={preparedFile} onInitialFileConsumed={onPreparedFileConsumed} />
  );
}
