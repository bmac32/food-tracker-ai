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
        <div className="bg-surface border border-dashed border-hair-strong rounded-[22px] p-6 text-center transition-all duration-150 ease-spring hover:border-cal/40 hover:bg-surface-2 active:scale-[0.99]">

          <p className="text-sm font-bold text-ink">
            Add a meal
          </p>

          <p className="text-xs text-ink-faint mt-1">
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
        className="w-full text-sm text-ink-faint hover:text-ink active:scale-[0.98] transition"
      >
        Enter meal manually
      </button>

    </div>
  )
}