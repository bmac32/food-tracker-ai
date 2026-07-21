"use client"

type Props = {
  onFileSelect: (file: File) => void
}

export default function Upload({ onFileSelect }: Props) {
  return (
    <label className="group w-full flex items-center gap-3 bg-surface-2 border border-hair rounded-xl px-4 py-3.5 text-sm font-bold text-ink cursor-pointer transition-all duration-200 ease-spring hover:border-cal/40 active:scale-[0.98]">
      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-cal to-[#ffd479] flex items-center justify-center text-sm font-black text-ground shrink-0 transition-transform duration-300 ease-spring group-active:rotate-90">
        +
      </span>
      <span>
        <span className="block">Take a photo or upload</span>
        <span className="block text-xs font-normal text-ink-faint mt-0.5">
          Let AI estimate the nutrition
        </span>
      </span>

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
  )
}
