import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BankDetails, PaymentMode } from '@/types/claim';

interface PaymentSectionProps {
  paymentMode: PaymentMode;
  onPaymentModeChange: (mode: PaymentMode) => void;
  bankDetails: BankDetails;
  onBankDetailsChange: (details: BankDetails) => void;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentMode,
  onPaymentModeChange,
  bankDetails,
  onBankDetailsChange,
}) => {
  const updateField = (field: keyof BankDetails, value: string | number) => {
    onBankDetailsChange({ ...bankDetails, [field]: value });
  };

  return (
    <div className="bg-card border border-border rounded-sm p-4 mt-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Payment Mode</h3>
      <RadioGroup
        value={paymentMode}
        onValueChange={(v) => onPaymentModeChange(v as PaymentMode)}
        className="flex gap-6 mb-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="cash" id="cash" />
          <Label htmlFor="cash" className="text-sm cursor-pointer">Cash</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="net_banking" id="net_banking" />
          <Label htmlFor="net_banking" className="text-sm cursor-pointer">Net Banking</Label>
        </div>
      </RadioGroup>

      {paymentMode === 'net_banking' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 mt-1">
          <div className="md:col-span-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Name of the Bank & Branch</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={bankDetails.bankName}
                onChange={(e) => updateField('bankName', e.target.value)}
                placeholder="Bank Name"
                className="h-8 text-sm border-border"
              />
              <Input
                value={bankDetails.branch}
                onChange={(e) => updateField('branch', e.target.value)}
                placeholder="Branch"
                className="h-8 text-sm border-border"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Account Number</Label>
            <Input
              value={bankDetails.accountNumber}
              onChange={(e) => updateField('accountNumber', e.target.value)}
              className="h-8 text-sm border-border font-mono tracking-wider"
              placeholder="Enter Account No."
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Account Type</Label>
            <Input
              value={bankDetails.accountType}
              onChange={(e) => updateField('accountType', e.target.value)}
              placeholder="SB / CA"
              className="h-8 text-sm border-border"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">IFSC Code</Label>
            <Input
              value={bankDetails.ifscCode}
              onChange={(e) => updateField('ifscCode', e.target.value.toUpperCase())}
              className="h-8 text-sm border-border font-mono uppercase"
              placeholder="EX: SBIN0001234"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-primary">Claimed Amount (Rs.)</Label>
            <Input
              type="number"
              value={bankDetails.amount || 0}
              readOnly
              className="h-8 text-sm bg-primary/5 border-primary/20 font-bold text-primary"
            />
            <p className="text-[9px] text-muted-foreground mt-0.5 italic">Auto-calculated from claim</p>
          </div>
        </div>
      )}
    </div>
  );
};
