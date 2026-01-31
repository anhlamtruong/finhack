import Image from "next/image";
export const Logo = () => {
  return (
    <div className="text-foreground fill-primary hue-rotate-180">
      <Image
        src={"/logo/logo.svg"}
        width={100}
        height={100}
        className="w-120 h-120 fill-current text-accent-foreground"
        alt="Logo"
      />
    </div>
  );
};
