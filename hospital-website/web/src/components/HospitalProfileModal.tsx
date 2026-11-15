import { useState } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './Button';
import { Modal } from './ui/Modal';
import { Alert } from './ui/Alert';
import { Icon } from './ui/Icon';
import { Building2, MapPin } from 'lucide-react';

export function HospitalProfileModal({
  open,
  onClose,
  hospitalName,
  hospitalCode,
}: {
  open: boolean;
  onClose: () => void;
  hospitalName: string;
  hospitalCode?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Hospital profile" size="md">
      <div className="flex flex-col gap-4">
        <Card padded className="p-4">
          <CardHeader
            icon={<Icon icon={Building2} size={18} />}
            title={hospitalName}
            subtitle={hospitalCode ? hospitalCode : 'Hospital'}
          />
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-muted">Status</span>
              <span className="font-medium">Registered</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
              <span className="text-muted">Location</span>
              <span className="flex items-center gap-1.5">
                <Icon icon={MapPin} size={14} />
                Set in registry
              </span>
            </div>
          </div>
        </Card>
        <Alert tone="info" title="More coming soon">
          Capacity, trauma level, and address editing will arrive in the next pass.
        </Alert>
      </div>
    </Modal>
  );
}
