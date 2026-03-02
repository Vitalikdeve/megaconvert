import React from 'react';

export default function BatchUploader({ files = [], onFilesSelected }) {
  return (
    <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
      <div className="font-semibold text-slate-800">Batch upload</div>
      <div className="mt-1">Upload multiple files and process them as a queue.</div>
      <input
        type="file"
        multiple
        className="mt-3 block w-full text-sm"
        onChange={(event) => onFilesSelected?.(event.target.files)}
      />
      {!!files.length && <div className="mt-2 text-xs text-slate-500">Selected: {files.length}</div>}
    </label>
  );
}

