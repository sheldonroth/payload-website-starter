'use client'

import React from 'react'

// Simple test component to verify custom field rendering works
const SourceVideoField: React.FC<any> = (props) => {
    return (
        <div style={{
            padding: '16px',
            background: '#fef3c7',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '2px solid #fcd34d',
        }}>
            <strong>🎬 Source Video Field Test</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#92400e' }}>
                If you see this, the custom component is rendering!
            </p>
            <pre style={{ fontSize: '10px', marginTop: '8px', overflow: 'auto' }}>
                {JSON.stringify(Object.keys(props), null, 2)}
            </pre>
        </div>
    )
}

export default SourceVideoField
