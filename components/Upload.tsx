"use client"

type Props = {
  onFileSelect: (file: File) => void
}

export default function Upload({ onFileSelect }: Props) {
  return (
    <label className="group flex-1 flex items-center justify-center gap-2 bg-surface border border-hair-strong rounded-2xl py-3.5 text-sm font-bold text-ink cursor-pointer transition-all duration-200 ease-spring hover:border-cal/40 hover:bg-surface-2 active:scale-[0.97]">
      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cal to-[#ffd479] flex items-center justify-center text-[13px] font-black text-ground transition-transform duration-300 ease-spring group-active:rotate-90">
        +
      </span>
      Log meal

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
