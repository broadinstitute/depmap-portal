import * as React from "react";
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  TabsProps,
} from "src/common/components/tabs";

export default {
  title: "Components/Common/Tabs",
  component: Tabs,
};

const Template = (props: TabsProps) => {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Tabs {...props}>
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Perturbation Effects</Tab>
        <Tab>Perturbation Confidence</Tab>
        <Tab>Characterization</Tab>
        <Tab>Genomic Associations</Tab>
        <Tab>Predictability</Tab>
        <Tab>Description</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <h2>Overview</h2>
        </TabPanel>
        <TabPanel>
          <h2>Perturbation Effect</h2>
        </TabPanel>
        <TabPanel>
          <h2>Perturbation Confidence</h2>
        </TabPanel>
        <TabPanel>
          <h2>Characterization</h2>
        </TabPanel>
        <TabPanel>
          <h2>Genomic Associations</h2>
        </TabPanel>
        <TabPanel>
          <h2>Predictability</h2>
        </TabPanel>
        <TabPanel>
          <h2>Description</h2>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

export const AllProps = Template.bind({}) as any;

AllProps.argTypes = {
  id: { control: { disable: true } },
  children: { control: { disable: true } },
  defaultIndex: { control: { disable: true } },
  index: { control: { disable: true } },
  isLazy: { control: { disable: true } },
  isManual: { control: { disable: true } },
  lazyBehavior: { control: { disable: true } },
};

export const Controlled = Template.bind({}) as any;

Controlled.args = {
  index: 0,
};

Controlled.argTypes = {
  index: {
    control: {
      type: "range",
      min: 0,
      max: 6,
    },
  },
  onChange: { action: "changed" },
  id: { table: { disable: true } },
  children: { table: { disable: true } },
  defaultIndex: { table: { disable: true } },
  isLazy: { table: { disable: true } },
  isManual: { table: { disable: true } },
  lazyBehavior: { table: { disable: true } },
};

Controlled.decorators = [
  (Story: React.FC) => (
    <div>
      <Story />
      <hr />
      <p>
        By default, the `Tabs` component manages its own state (in this case you
        can provide a `defaultIndex` prop to specify which tab should be
        initially selected). If you need to control it yourself (e.g. an
        external button is allowed to change tabs), use the `index` and
        `onChange` props.
      </p>
    </div>
  ),
];

export const withLazyTabs = (props: TabsProps) => {
  const Lazy = ({ children }: any) => {
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 1000);

      return () => clearTimeout(timeout);
    }, []);

    return loading ? (
      <div style={{ padding: "18px 0" }}>Loading...</div>
    ) : (
      children
    );
  };

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Tabs {...props}>
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Perturbation Effects</Tab>
        <Tab>Perturbation Confidence</Tab>
        <Tab>Characterization</Tab>
        <Tab>Genomic Associations</Tab>
        <Tab>Predictability</Tab>
        <Tab>Description</Tab>
      </TabList>
      <TabPanels>
        <TabPanel>
          <Lazy>
            <h2>Overview</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Perturbation Effect</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Perturbation Confidence</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Characterization</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Genomic Associations</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Predictability</h2>
          </Lazy>
        </TabPanel>
        <TabPanel>
          <Lazy>
            <h2>Description</h2>
          </Lazy>
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};

withLazyTabs.decorators = [
  (Story: React.FC) => (
    <div>
      <Story />
      <hr />
      <p>
        When `isLazy` is set to true, each lazy tab panel is not rendered until
        its tab has been selected at least once. The `lazyBehavior` prop can be
        used to specify whether the the panel should be unmounted when it
        becomes unselected or whether it should remain in the DOM (and merely
        hidden with CSS).
      </p>
    </div>
  ),
];

withLazyTabs.args = {
  isLazy: true,
};

withLazyTabs.argTypes = {
  children: { table: { disable: true } },
  defaultIndex: { table: { disable: true } },
  id: { table: { disable: true } },
  index: { table: { disable: true } },
  isManual: { table: { disable: true } },
  onChange: { table: { disable: true } },
};

export const withManualActivation = Template.bind({}) as any;

withManualActivation.decorators = [
  (Story: React.FC) => (
    <div>
      <Story />
      <hr />
      <p>
        The `isManual` prop controls how keyboard controls work. Try using the
        left and right arrows to move between tabs. When it’s set to true, you
        must press Space or Enter to active the corresponding tab panel. When
        false (the default), the tabs will be automatically activated and their
        panel is displayed when they receive focus.
      </p>
    </div>
  ),
];

withManualActivation.args = {
  isManual: true,
};

withManualActivation.argTypes = {
  children: { table: { disable: true } },
  defaultIndex: { table: { disable: true } },
  id: { table: { disable: true } },
  index: { table: { disable: true } },
  isLazy: { table: { disable: true } },
  lazyBehavior: { table: { disable: true } },
  onChange: { table: { disable: true } },
};
