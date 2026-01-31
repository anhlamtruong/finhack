import { SettingsCard } from "@/services/settings/components/settings-cards";

type Props = {
  id?: string;
};
const SettingPage = ({}: Props) => {
  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16">
      <SettingsCard />
    </div>
  );
};

export default SettingPage;
