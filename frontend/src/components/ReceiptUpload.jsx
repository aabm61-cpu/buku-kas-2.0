import React, { useRef, useState } from "react";
import { Camera, Upload, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Compress image to base64 (max 1200px width, ~80% quality)
async function fileToCompressedBase64(file, maxDim = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = (height * maxDim) / width; width = maxDim; }
          else { width = (width * maxDim) / height; height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ReceiptUpload({ value, onChange, required = true, testId = "receipt-upload" }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    setBusy(true);
    try {
      const b64 = await fileToCompressedBase64(f);
      onChange(b64);
    } catch (err) {
      toast.error("Gagal memproses foto");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  if (value) {
    return (
      <div className="relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
        <img src={value} alt="Nota" className="w-full max-h-64 object-contain" data-testid={`${testId}-preview`} />
        <Button
          type="button"
          data-testid={`${testId}-remove`}
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 h-8 rounded-full"
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 bg-slate-50/50 text-center">
        <ImagePlus className="h-10 w-10 mx-auto text-slate-400 mb-2" />
        <div className="text-sm font-medium text-slate-700 mb-1">
          Foto Nota {required && <span className="text-red-500">*</span>}
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button
            type="button"
            data-testid={`${testId}-camera-btn`}
            variant="outline"
            onClick={() => camRef.current?.click()}
            disabled={busy}
            className="rounded-full"
          >
            <Camera className="h-4 w-4 mr-2" /> Ambil Foto
          </Button>
          <Button
            type="button"
            data-testid={`${testId}-upload-btn`}
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-full"
          >
            <Upload className="h-4 w-4 mr-2" /> Upload
          </Button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
}
