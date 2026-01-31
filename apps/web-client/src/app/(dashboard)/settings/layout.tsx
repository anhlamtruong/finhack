import { AsyncBoundary } from "@/components/async-boundary";

type Props = {
  children: React.ReactNode;
};

const SettingLayout = ({ children }: Props) => {
  return (
    <AsyncBoundary>
      <main className="px-3 lg:px:4">{children}</main>
    </AsyncBoundary>
  );
};

export default SettingLayout;
