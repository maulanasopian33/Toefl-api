'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Create batchsessions table
      await queryInterface.createTable('batchsessions', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        batch_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'batches',
            key: 'idBatch'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        title: {
          type: Sequelize.STRING
        },
        session_type: {
          type: Sequelize.ENUM('CLASS', 'TRYOUT', 'DISCUSSION'),
          defaultValue: 'CLASS'
        },
        start_at: {
          type: Sequelize.DATE
        },
        end_at: {
          type: Sequelize.DATE
        },
        meeting_url: {
          type: Sequelize.STRING
        },
        trainer_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: {
            model: 'users',
            key: 'uid'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        capacity: {
          type: Sequelize.INTEGER
        },
        notes: {
          type: Sequelize.TEXT
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      }, { transaction });

      await queryInterface.addIndex('batchsessions', ['batch_id', 'start_at'], { transaction });

      // 2. Update batches table
      const table = 'batches';

      // Rename columns
      await queryInterface.renameColumn(table, 'namaBatch', 'name', { transaction });
      await queryInterface.renameColumn(table, 'deskripsiBatch', 'description', { transaction });
      await queryInterface.renameColumn(table, 'tanggalMulai', 'start_date', { transaction });
      await queryInterface.renameColumn(table, 'tanggalSelesai', 'end_date', { transaction });
      await queryInterface.renameColumn(table, 'batasMaksimalPeserta', 'max_participants', { transaction });
      await queryInterface.renameColumn(table, 'intruksiKhusus', 'special_instructions', { transaction });
      await queryInterface.renameColumn(table, 'statusBatch', 'status', { transaction });
      
      // Handle duration: Rename first, then update value (seconds -> minutes)
      await queryInterface.renameColumn(table, 'duration', 'duration_minutes', { transaction });

      // Add new columns
      await queryInterface.addColumn(table, 'type', {
        type: Sequelize.ENUM('PREP_CLASS', 'TRYOUT_ONLY', 'FULL_PACKAGE'),
        defaultValue: 'PREP_CLASS'
      }, { transaction });

      await queryInterface.addColumn(table, 'registration_open_at', {
        type: Sequelize.DATE
      }, { transaction });

      await queryInterface.addColumn(table, 'registration_close_at', {
        type: Sequelize.DATE
      }, { transaction });

      await queryInterface.addColumn(table, 'min_participants', {
        type: Sequelize.INTEGER
      }, { transaction });

      await queryInterface.addColumn(table, 'currency', {
        type: Sequelize.STRING,
        defaultValue: 'IDR'
      }, { transaction });

      await queryInterface.addColumn(table, 'created_by', {
        type: Sequelize.STRING,
        references: {
          model: 'users',
          key: 'uid'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      // Change types
      await queryInterface.changeColumn(table, 'price', {
        type: Sequelize.INTEGER,
      }, { transaction });

      await queryInterface.changeColumn(table, 'status', {
        type: Sequelize.ENUM('DRAFT', 'OPEN', 'CLOSED', 'RUNNING', 'FINISHED', 'CANCELLED'),
        defaultValue: 'DRAFT'
      }, { transaction });

      // Update duration_minutes values (seconds -> minutes)
      await queryInterface.sequelize.query(
        `UPDATE ${table} SET duration_minutes = duration_minutes / 60`, 
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    // Note: Reverting complex changes like this can be risky if data was modified significantly.
    // This down migration attempts to restore the previous schema structure.
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const table = 'batches';

      // Revert duration calculation (minutes -> seconds)
      await queryInterface.sequelize.query(
        `UPDATE ${table} SET duration_minutes = duration_minutes * 60`, 
        { transaction }
      );

      // Remove new columns
      await queryInterface.removeColumn(table, 'created_by', { transaction });
      await queryInterface.removeColumn(table, 'currency', { transaction });
      await queryInterface.removeColumn(table, 'min_participants', { transaction });
      await queryInterface.removeColumn(table, 'registration_close_at', { transaction });
      await queryInterface.removeColumn(table, 'registration_open_at', { transaction });
      await queryInterface.removeColumn(table, 'type', { transaction });

      // Revert types
      await queryInterface.changeColumn(table, 'price', {
        type: Sequelize.DECIMAL
      }, { transaction });

      await queryInterface.changeColumn(table, 'status', {
        type: Sequelize.STRING
      }, { transaction });

      // Revert renames
      await queryInterface.renameColumn(table, 'name', 'namaBatch', { transaction });
      await queryInterface.renameColumn(table, 'description', 'deskripsiBatch', { transaction });
      await queryInterface.renameColumn(table, 'start_date', 'tanggalMulai', { transaction });
      await queryInterface.renameColumn(table, 'end_date', 'tanggalSelesai', { transaction });
      await queryInterface.renameColumn(table, 'max_participants', 'batasMaksimalPeserta', { transaction });
      await queryInterface.renameColumn(table, 'special_instructions', 'intruksiKhusus', { transaction });
      await queryInterface.renameColumn(table, 'status', 'statusBatch', { transaction });
      await queryInterface.renameColumn(table, 'duration_minutes', 'duration', { transaction });

      // Drop batchsessions
      await queryInterface.dropTable('batchsessions', { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};