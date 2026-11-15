'use client';

import React, { useRef } from 'react';
import { Sale } from '@/types/database';
import { Printer, CheckCircle2, X, Share2, ArrowRight } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onNewSale?: () => void;
}

export default function ReceiptModal({ isOpen, onClose, sale, onNewSale }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.created_at).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      {/* Container */}
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Action Bar (Hidden in Print) */}
        <div className="p-4 bg-teal-700 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-teal-300" />
            <span className="font-bold text-sm tracking-wide">Sale Bill Generated Successfully</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-teal-800 text-teal-200 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content Printable Area */}
        <div className="p-6 overflow-y-auto flex-1 font-sans print:p-0 print:m-0" ref={printRef}>
          <div className="border border-dashed border-gray-300 p-5 rounded-2xl bg-gray-50/40 print:border-none print:bg-white print:p-0">
            
            {/* Pharmacy Branding Header */}
            <div className="text-center border-b border-gray-300 pb-4 mb-4">
              <h2 className="text-lg font-black text-gray-900 tracking-tight uppercase">
                DRRK Healthcare Pharmacy
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Multi-Speciality Clinic &amp; Dispensing Pharmacy
              </p>
              <div className="flex items-center justify-center gap-3 text-[11px] text-gray-500 mt-1 font-mono">
                <span>DL No: DL-TN-CH-12345/20</span>
                <span>•</span>
                <span>GSTIN: 33AAAAA0000A1Z5</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Phone: +91 98400 12345 | Chennai, Tamil Nadu
              </p>
            </div>

            {/* Bill Meta Info */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-4 text-gray-700 pb-3 border-b border-gray-200">
              <div>
                <p className="text-gray-400 text-[10px] uppercase font-bold">Bill Number</p>
                <p className="font-mono font-bold text-gray-900">{sale.bill_number}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Date &amp; Time</p>
                <p className="font-medium text-gray-800">{formattedDate}</p>
              </div>
              <div className="mt-1">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Patient / Customer</p>
                <p className="font-semibold text-gray-900">{sale.customer_name || 'Counter Patient'}</p>
                {sale.customer_phone && (
                  <p className="text-[11px] text-gray-500 font-mono">{sale.customer_phone}</p>
                )}
              </div>
              <div className="text-right mt-1">
                <p className="text-gray-400 text-[10px] uppercase font-bold">Doctor / Prescriber</p>
                <p className="font-semibold text-gray-900">{sale.doctor_name || 'Dr. Self / Walk-in'}</p>
                <p className="text-[11px] text-teal-700 font-bold uppercase">{sale.payment_method} Payment</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-[10px] uppercase font-bold text-gray-500">
                    <th className="py-1.5 pr-2">Item &amp; Batch</th>
                    <th className="py-1.5 px-2 text-center">Exp</th>
                    <th className="py-1.5 px-2 text-right">Qty</th>
                    <th className="py-1.5 px-2 text-right">Rate</th>
                    <th className="py-1.5 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sale.items && sale.items.map((item, idx) => (
                    <tr key={idx} className="text-gray-800">
                      <td className="py-2 pr-2">
                        <p className="font-bold text-gray-900 leading-tight">{item.medicine_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono">B.No: {item.batch_number}</p>
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-[10px] text-gray-600 whitespace-nowrap">
                        {item.expiry_date ? item.expiry_date.slice(0, 7) : '-'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-gray-600">
                        ₹{item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-bold text-gray-900">
                        ₹{item.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Totals */}
            <div className="border-t border-gray-300 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (Items Total):</span>
                <span className="font-mono">₹{sale.total_amount.toFixed(2)}</span>
              </div>
              {sale.tax_amount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST Output Tax:</span>
                  <span className="font-mono">+ ₹{sale.tax_amount.toFixed(2)}</span>
                </div>
              )}
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Special Discount:</span>
                  <span className="font-mono">- ₹{sale.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-2 border-t border-gray-300">
                <span>NET PAYABLE (INCL. TAX):</span>
                <span className="font-mono text-base text-teal-700">₹{sale.net_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="text-center pt-5 mt-4 border-t border-dashed border-gray-300 text-[10px] text-gray-500 space-y-0.5">
              <p className="font-medium text-gray-700">Thank you for visiting DRRK Healthcare! Wish you speedy recovery.</p>
              <p>Medicines once sold can only be returned within 48 hours with intact original strip/seal.</p>
              <p className="text-[9px] text-gray-400 font-mono mt-1">Dispensed by: {sale.created_by_name || 'Staff'}</p>
            </div>

          </div>
        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt / Thermal Bill</span>
          </button>

          {onNewSale && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-md shadow-teal-100"
            >
              <span>Start Next Bill</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
