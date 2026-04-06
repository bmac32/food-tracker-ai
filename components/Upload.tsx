"use client"

type Props = {
  onFileSelect: (file: File) => void
  onManualEntry: () => void
}

export default function Upload({ onFileSelect, onManualEntry }: Props) {
  return (
    <div className="space-y-3">

      {/* UPLOAD + CAMERA COMBINED */}
      <label className="block cursor-pointer">
        <div className="bg-[#171A21] border border-dashed border-[#2a2f3a] rounded-2xl p-6 text-center transition hover:border-[#3a4152] hover:bg-[#1d212b] active:scale-[0.99]">

          <p className="text-sm font-medium text-[#E6E8EC]">
            Add a meal
          </p>

          <p className="text-xs text-[#9AA3B2] mt-1">
            Take a photo or upload
          </p>

        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onFileSelect(e.target.files[0])
            }
          }}
        />
      </label>

      {/* 🔥 MANUAL ENTRY (THIS WAS BROKEN) */}
      <button
        onClick={onManualEntry}
        className="w-full text-sm text-[#9AA3B2] hover:text-white transition"
      >
        Enter meal manually
      </button>

    </div>
  )
}