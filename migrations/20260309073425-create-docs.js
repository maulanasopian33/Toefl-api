'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('docs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Umum'
      },
      category_icon: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'lucide:book-open'
      },
      content_md: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      order_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Index for fast slug lookups and category filtering
    await queryInterface.addIndex('docs', ['slug']);
    await queryInterface.addIndex('docs', ['category', 'status', 'order_num']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('docs');
  }
};
